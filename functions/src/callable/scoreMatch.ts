import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { Timestamp } from 'firebase-admin/firestore';
import { calcPoints, ScoringRuleKey } from '../lib/scoring';

interface ScoreMatchRequest {
  matchId: string;
}

/**
 * Reemplaza la Edge Function `score-match`.
 *
 * FIX respecto al original: la Edge Function de Supabase cargaba las reglas
 * con `.from('scoring_rules').eq('tournament_id', match.tournament_id)`, pero
 * `scoring_rules` se volvió global en la migración 006 (se eliminó la columna
 * `tournament_id`). Esa query rompe contra el schema actual — probablemente
 * el scoring está fallando en producción ahora mismo. Acá se corrige leyendo
 * `scoringRules` sin filtro de torneo (doc ID = rule_key).
 *
 * Modelo de puntos (aditivo, no categórico): 3 pts por acertar el resultado
 * (local/empate/visitante) + 1 pt por acertar los goles del local + 1 pt por
 * acertar los goles del visitante — los tres criterios se evalúan de forma
 * independiente y se suman (máximo 5 con marcador exacto).
 */
export const scoreMatch = onCall<ScoreMatchRequest>(async (request) => {
  const { matchId } = request.data;
  if (!matchId) {
    throw new HttpsError('invalid-argument', 'matchId es requerido');
  }

  // Solo superadmin (o llamado internamente por otra función con Admin SDK,
  // que no pasa por onCall y por lo tanto no pasa por este chequeo).
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Debe estar autenticado');
  const caller = await db.collection('users').doc(callerUid).get();
  if (caller.data()?.['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Solo superadmin puede recalcular puntajes');
  }

  return scoreMatchInternal(matchId);
});

export async function scoreMatchInternal(matchId: string): Promise<{ scored: number }> {
  // 1. Cargar match
  const matchSnap = await db.collection('matches').doc(matchId).get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match no encontrado');
  }
  const match = matchSnap.data()!;
  if (match['status'] !== 'finished' || match['homeScore'] == null || match['awayScore'] == null) {
    throw new HttpsError(
      'failed-precondition',
      'El partido no está finalizado o no tiene resultado',
    );
  }

  // 2. Cargar reglas de puntuación (globales)
  const rulesSnap = await db.collection('scoringRules').get();
  const pointsMap: Record<ScoringRuleKey, number> = {
    correct_outcome: 0,
    home_goals: 0,
    away_goals: 0,
  };
  for (const doc of rulesSnap.docs) {
    const key = doc.id as ScoringRuleKey;
    if (key in pointsMap) pointsMap[key] = doc.data()['pointsValue'] ?? 0;
  }

  // 3. Cargar predicciones de este partido
  const predsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();
  if (predsSnap.empty) {
    return { scored: 0 };
  }

  // 4. Calcular puntos y actualizar en batches (límite de 500 escrituras por batch)
  const affectedPairs = new Map<string, { userId: string; groupId: string }>();
  const chunks = chunk(predsSnap.docs, 450);

  for (const docs of chunks) {
    const batch = db.batch();
    for (const doc of docs) {
      const p = doc.data();
      const points = calcPoints(
        p['predictedHome'],
        p['predictedAway'],
        match['homeScore'],
        match['awayScore'],
        pointsMap,
      );
      batch.update(doc.ref, { pointsEarned: points });
      affectedPairs.set(`${p['userId']}_${p['groupId']}`, {
        userId: p['userId'],
        groupId: p['groupId'],
      });
    }
    await batch.commit();
  }

  // 5. Recalcular totalPoints por cada (userId, groupId) afectado
  const scoreChunks = chunk([...affectedPairs.values()], 450);
  for (const pairs of scoreChunks) {
    const batch = db.batch();
    for (const { userId, groupId } of pairs) {
      const userPreds = await db
        .collection('predictions')
        .where('userId', '==', userId)
        .where('groupId', '==', groupId)
        .get();

      const total = userPreds.docs.reduce((sum, d) => sum + (d.data()['pointsEarned'] ?? 0), 0);

      const scoreRef = db.collection('scores').doc(`${userId}_${groupId}`);
      batch.set(
        scoreRef,
        {
          userId,
          groupId,
          tournamentId: match['tournamentId'],
          totalPoints: total,
          lastCalculatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    }
    await batch.commit();
  }

  return { scored: predsSnap.size };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

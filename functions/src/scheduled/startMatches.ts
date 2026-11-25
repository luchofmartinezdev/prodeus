import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { db } from '../admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Reemplaza la Edge Function `start-matches` + su cron de Supabase.
 * Corre cada minuto vía Cloud Scheduler y pasa a 'in_progress' los partidos
 * 'scheduled' cuya matchDate ya pasó.
 */
export const startMatches = onSchedule('every 1 minutes', async () => {
  const now = Timestamp.now();

  const snap = await db
    .collection('matches')
    .where('status', '==', 'scheduled')
    .where('matchDate', '<=', now)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: 'in_progress' });
  }
  await batch.commit();

  logger.info(`startMatches: ${snap.size} partido(s) pasados a in_progress`, {
    matchIds: snap.docs.map((d) => d.id),
  });
});

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from '../admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Reemplaza el trigger `handle_member_approved` (migración 003): cuando un
 * miembro pasa a status 'active' (alta o cambio), inicializa su doc en
 * `scores` (fusiona `prodes` + `scores`, ver docs/firebase/01-firestore-schema.md).
 */
export const onMemberStatusChange = onDocumentWritten(
  'groups/{groupId}/members/{userId}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!after) return; // delete — nada que hacer

    const becameActive = after['status'] === 'active' && before?.['status'] !== 'active';
    if (!becameActive) return;

    const { groupId, userId } = event.params;

    const group = await db.collection('groups').doc(groupId).get();
    if (!group.exists) return;
    const tournamentId = group.data()?.['tournamentId'];

    const scoreRef = db.collection('scores').doc(`${userId}_${groupId}`);
    const existing = await scoreRef.get();
    if (existing.exists) return; // idempotente, igual que el "on conflict do nothing" original

    await scoreRef.set({
      userId,
      groupId,
      tournamentId,
      totalPoints: 0,
      finalPosition: null,
      lastCalculatedAt: Timestamp.now(),
    });
  },
);

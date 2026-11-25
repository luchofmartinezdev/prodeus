import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { db } from '../admin';
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

/**
 * Limpieza en cascada al borrar un grupo — equivalente al `on delete cascade`
 * que tenían `group_members`, `predictions` y `scores`/`prodes` en Postgres.
 *
 * Corre acá (Admin SDK) y no en el cliente porque `predictions` tiene
 * `allow delete: if false` y `scores` tiene `allow write: if false` en
 * firestore.rules a propósito (solo las Cloud Functions deben tocarlas) —
 * `GroupRepository.remove()` intentaba borrarlas directamente desde el
 * cliente y fallaba con permission-denied. El cliente ahora solo borra el
 * doc del grupo; este trigger se encarga del resto.
 */
export const onGroupDelete = onDocumentDeleted('groups/{groupId}', async (event) => {
  const groupId = event.params.groupId;

  await deleteAll(db.collection('groups').doc(groupId).collection('members'));
  await deleteAll(db.collection('predictions').where('groupId', '==', groupId));
  await deleteAll(db.collection('scores').where('groupId', '==', groupId));
});

async function deleteAll(query: Query): Promise<void> {
  const snap = await query.get();
  if (snap.empty) return;
  // Límite de 500 escrituras por batch de Firestore.
  const chunks: QueryDocumentSnapshot[][] = [];
  for (let i = 0; i < snap.docs.length; i += 450) chunks.push(snap.docs.slice(i, i + 450));
  for (const docs of chunks) {
    const batch = db.batch();
    docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

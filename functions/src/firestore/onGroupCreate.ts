import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Reemplaza el trigger `handle_group_created` (migración 003): al crear un
 * grupo, agrega al líder como miembro activo.
 *
 * Respaldo idempotente: `GroupRepository.create()` ya escribe este mismo doc
 * en el mismo batch que el grupo (evita una carrera real donde el cliente
 * navegaba al detalle y pedía la lista de miembros antes de que este trigger
 * asíncrono terminara — `isGroupMember()` todavía no encontraba al líder y la
 * regla denegaba la lectura). Este trigger solo cubre el caso de que el grupo
 * se cree por otra vía que no pase por el repositorio (ej. un script con
 * Admin SDK) — por eso chequea si el doc ya existe antes de escribir, para no
 * pisar el `joinedAt` original con cada alta.
 *
 * Nota: el índice único `groups_one_leader_per_tournament` (migración 003,
 * "un usuario no puede liderar más de un grupo por torneo") se dio de baja
 * a pedido — un usuario puede liderar varios grupos del mismo torneo. No se
 * migra ninguna validación equivalente.
 */
export const onGroupCreate = onDocumentCreated('groups/{groupId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const group = snap.data();
  const groupId = event.params.groupId;
  const memberRef = db
    .collection('groups')
    .doc(groupId)
    .collection('members')
    .doc(group['leaderId']);

  const existing = await memberRef.get();
  if (existing.exists) return;

  await memberRef.set({
    userId: group['leaderId'],
    status: 'active',
    joinedAt: Timestamp.now(),
  });
});

import { user } from 'firebase-functions/v1/auth';
import { db } from '../admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Reemplaza el trigger `handle_new_user` (Postgres, migración 003) + el paso
 * `syncGoogleNames` que hoy corre client-side en auth.store.ts. Se unifica en
 * un solo paso porque Firebase Auth ya expone displayName/photoURL resueltos
 * por el provider de Google al momento de crear el usuario.
 */
export const onUserCreate = user().onCreate(async (userRecord) => {
  const username = userRecord.email ? userRecord.email.split('@')[0] : userRecord.uid;

  const fullName = userRecord.displayName?.trim() ?? '';
  const [firstName = null, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.length > 0 ? rest.join(' ') : null;

  await db
    .collection('users')
    .doc(userRecord.uid)
    .set({
      username,
      firstName,
      lastName,
      avatarUrl: userRecord.photoURL ?? null,
      role: 'user',
      createdAt: Timestamp.now(),
    });
});

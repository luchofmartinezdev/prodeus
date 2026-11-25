import { Injectable } from '@angular/core';
import { z } from 'zod';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase.client';
import { mapFirestoreError, raceWithAbort, tsToIso, type RepoResult } from '../firestore-helpers';
import type { Group, GroupMember, Profile, Tournament } from '../database.types';

// ─── Types ────────────────────────────────────────────────────

export type GroupWithTournament = Group & {
  tournament: Pick<Tournament, 'id' | 'name' | 'status' | 'logo_url'>;
};

export type MemberWithProfile = GroupMember & {
  profile: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
};

// ─── Schema ───────────────────────────────────────────────────

export const groupSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(60, 'Máximo 60 caracteres'),
  tournament_id: z.string().min(1, 'El torneo es requerido'),
  visibility: z.enum(['public', 'private']),
});

export type GroupDto = z.infer<typeof groupSchema>;

// ─── Row mapping ──────────────────────────────────────────────

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Código de acceso de 6 caracteres alfanuméricos — lo tiene todo grupo, público o privado. */
function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = '';
  for (const b of bytes) code += INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length];
  return code;
}

function toGroupRow(id: string, d: Record<string, unknown>): Group {
  return {
    id,
    tournament_id: d['tournamentId'] as string,
    name: d['name'] as string,
    leader_id: d['leaderId'] as string,
    visibility: d['visibility'] as Group['visibility'],
    invite_code: d['inviteCode'] as string,
    created_at: tsToIso(d['createdAt']),
  };
}

async function withTournament(
  id: string,
  d: Record<string, unknown>,
): Promise<GroupWithTournament> {
  const group = toGroupRow(id, d);
  const tSnap = await getDoc(doc(db, 'tournaments', group.tournament_id));
  const t = tSnap.data();
  return {
    ...group,
    tournament: {
      id: group.tournament_id,
      name: (t?.['name'] as string) ?? '',
      status: (t?.['status'] as Tournament['status']) ?? 'draft',
      logo_url: (t?.['logoUrl'] as string | null) ?? null,
    },
  };
}

async function toMemberRow(memberDoc: QueryDocumentSnapshot): Promise<MemberWithProfile> {
  const d = memberDoc.data();
  const userId = memberDoc.id;
  const groupId = memberDoc.ref.parent.parent!.id;
  const profileSnap = await getDoc(doc(db, 'users', userId));
  const p = profileSnap.data();
  return {
    id: userId,
    group_id: groupId,
    user_id: userId,
    status: d['status'] as MemberWithProfile['status'],
    joined_at: d['joinedAt'] ? tsToIso(d['joinedAt']) : null,
    profile: {
      id: userId,
      username: (p?.['username'] as string) ?? '—',
      avatar_url: (p?.['avatarUrl'] as string | null) ?? null,
    },
  };
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GroupRepository {
  async findByUser(
    userId: string,
    signal?: AbortSignal,
  ): Promise<RepoResult<GroupWithTournament[]>> {
    try {
      const q = query(
        collectionGroup(db, 'members'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
      );
      const snap = await raceWithAbort(getDocs(q), signal);
      const groups = await raceWithAbort(
        Promise.all(
          snap.docs.map(async (memberDoc) => {
            const groupId = memberDoc.ref.parent.parent!.id;
            const groupSnap = await getDoc(doc(db, 'groups', groupId));
            if (!groupSnap.exists()) return null;
            return withTournament(groupSnap.id, groupSnap.data());
          }),
        ),
        signal,
      );
      return { data: groups.filter((g): g is GroupWithTournament => g !== null), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async findOne(id: string): Promise<RepoResult<GroupWithTournament>> {
    try {
      const snap = await getDoc(doc(db, 'groups', id));
      if (!snap.exists()) {
        return { data: null, error: { code: 'not-found', message: 'Grupo no encontrado' } };
      }
      return { data: await withTournament(snap.id, snap.data()), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async findMembers(groupId: string): Promise<RepoResult<MemberWithProfile[]>> {
    try {
      const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
      const members = await Promise.all(
        snap.docs.filter((d) => d.data()['status'] !== 'removed').map((d) => toMemberRow(d)),
      );
      // orden: joined_at asc, nulls al final (Firestore no soporta nullsFirst:false nativo)
      members.sort((a, b) => {
        if (!a.joined_at && !b.joined_at) return 0;
        if (!a.joined_at) return 1;
        if (!b.joined_at) return -1;
        return a.joined_at.localeCompare(b.joined_at);
      });
      return { data: members, error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async findByInviteCode(code: string): Promise<RepoResult<GroupWithTournament>> {
    try {
      const q = query(
        collection(db, 'groups'),
        where('inviteCode', '==', code.trim().toUpperCase()),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        return { data: null, error: { code: 'not-found', message: 'Código inválido' } };
      }
      const found = snap.docs[0];
      return { data: await withTournament(found.id, found.data()), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /**
   * Crea el grupo Y la membresía activa del líder en el mismo batch atómico.
   *
   * La Cloud Function `onGroupCreate` (trigger) también agrega al líder como
   * miembro, pero es asíncrona — si el cliente navega al detalle del grupo y
   * pide la lista de miembros antes de que el trigger termine, `isGroupMember()`
   * todavía no encuentra al líder y la regla deniega la lectura (carrera real,
   * se vio como un toast de error justo después del de éxito). Escribiendo
   * ambos docs acá mismo, el cliente nunca depende del timing del trigger — la
   * Cloud Function queda como respaldo idempotente (por si el grupo se crea
   * por otra vía, ej. un script con Admin SDK).
   */
  async create(dto: GroupDto, leaderId: string): Promise<RepoResult<GroupWithTournament>> {
    const validated = groupSchema.parse(dto);
    const inviteCode = generateInviteCode();
    try {
      const ref = doc(collection(db, 'groups'));
      const memberRef = doc(db, 'groups', ref.id, 'members', leaderId);
      const now = Timestamp.now();
      const batch = writeBatch(db);
      batch.set(ref, {
        name: validated.name,
        tournamentId: validated.tournament_id,
        visibility: validated.visibility,
        leaderId,
        inviteCode,
        createdAt: now,
      });
      batch.set(memberRef, {
        userId: leaderId,
        status: 'active',
        joinedAt: now,
      });
      await batch.commit();
      const snap = await getDoc(ref);
      return { data: await withTournament(ref.id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async update(
    id: string,
    dto: Partial<Pick<GroupDto, 'name' | 'visibility'>>,
  ): Promise<RepoResult<GroupWithTournament>> {
    try {
      const patch: Record<string, unknown> = {};
      if (dto.name !== undefined) patch['name'] = dto.name;
      if (dto.visibility !== undefined) patch['visibility'] = dto.visibility;
      const ref = doc(db, 'groups', id);
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      return { data: await withTournament(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /** Grupos públicos, para el listado de "descubrir grupos" en /home. */
  async findPublicGroups(limitCount = 12): Promise<RepoResult<GroupWithTournament[]>> {
    try {
      const q = query(
        collection(db, 'groups'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount),
      );
      const snap = await getDocs(q);
      const groups = await Promise.all(snap.docs.map((d) => withTournament(d.id, d.data())));
      return { data: groups, error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /**
   * Borra el grupo. La limpieza en cascada de `members`, `predictions` y
   * `scores` la hace la Cloud Function `onGroupDelete` (Admin SDK) — el
   * cliente no tiene permiso para tocar `predictions`/`scores` directamente
   * (`allow delete: if false` / `allow write: if false` a propósito en
   * firestore.rules), así que solo borra el doc del grupo acá.
   */
  async remove(id: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'groups', id));
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  /** Unirse a un grupo — sin aprobación del líder, queda activo directamente. */
  async joinGroup(groupId: string, userId: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      await setDoc(
        doc(db, 'groups', groupId, 'members', userId),
        {
          userId,
          status: 'active',
          joinedAt: Timestamp.now(),
        },
        { merge: true },
      );
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  async updateMemberStatus(
    groupId: string,
    userId: string,
    status: 'active' | 'removed',
  ): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      await updateDoc(doc(db, 'groups', groupId, 'members', userId), {
        status,
        ...(status === 'active' ? { joinedAt: Timestamp.now() } : {}),
      });
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  leave(groupId: string, userId: string): Promise<{ error: RepoResult<never>['error'] }> {
    if (!groupId || !userId) {
      return Promise.reject(new Error('Group ID and User ID are required to leave a group'));
    }
    return (async () => {
      try {
        await updateDoc(doc(db, 'groups', groupId, 'members', userId), { status: 'removed' });
        return { error: null };
      } catch (e) {
        return { error: mapFirestoreError(e) };
      }
    })();
  }
}

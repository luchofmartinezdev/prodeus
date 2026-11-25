import { Injectable } from '@angular/core';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase.client';
import type { Profile } from '../database.types';

export interface RepoError {
  code: string;
  message: string;
}
export interface RepoResult<T> {
  data: T | null;
  error: RepoError | null;
}

function mapFirestoreError(e: unknown): RepoError {
  const err = e as { code?: string; message?: string };
  return { code: err.code ?? 'unknown', message: err.message ?? 'Error desconocido' };
}

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  async signInWithGoogle(): Promise<void> {
    // signInWithPopup en vez de signInWithRedirect: el redirect depende de que
    // el browser deje correlacionar storage entre `localhost` y el authDomain
    // (prodeus-app.firebaseapp.com) — con partición de storage de terceros
    // habilitada (default en Chrome moderno) esa correlación se rompe en
    // silencio (getRedirectResult() vuelve null sin error). El popup evita el
    // problema porque usa postMessage entre ventanas, no storage compartido.
    await signInWithPopup(auth, googleProvider);
  }

  signOut(): Promise<void> {
    return firebaseSignOut(auth);
  }

  onAuthStateChange(callback: (user: FirebaseUser | null) => void): { unsubscribe(): void } {
    const unsubscribe = onAuthStateChanged(auth, callback);
    return { unsubscribe };
  }

  async getProfile(userId: string): Promise<RepoResult<Profile>> {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) {
        return { data: null, error: { code: 'not-found', message: 'Perfil no encontrado' } };
      }
      const u = snap.data();
      const profile: Profile = {
        id: snap.id,
        username: u['username'],
        first_name: u['firstName'] ?? null,
        last_name: u['lastName'] ?? null,
        avatar_url: u['avatarUrl'] ?? null,
        role: u['role'],
        created_at: u['createdAt']?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
      return { data: profile, error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async updateProfile(
    userId: string,
    updates: { username?: string; first_name?: string | null; last_name?: string | null },
  ): Promise<RepoResult<Profile>> {
    try {
      const patch: Record<string, unknown> = {};
      if (updates.username !== undefined) patch['username'] = updates.username;
      if (updates.first_name !== undefined) patch['firstName'] = updates.first_name;
      if (updates.last_name !== undefined) patch['lastName'] = updates.last_name;
      await updateDoc(doc(db, 'users', userId), patch);
      return this.getProfile(userId);
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }
}

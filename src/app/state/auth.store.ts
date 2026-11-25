import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../data/firebase.client';
import type { Profile } from '../data/database.types';
import { AuthRepository } from '../data/repositories/auth.repository';

// ─── Tipos ───────────────────────────────────────────────────

// Subconjunto de firebase.User usado en toda la app — mantiene `.id` (en vez
// de `.uid`) para no tocar los ~10 call sites que ya leían `user()?.id` con
// Supabase.
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function toAuthUser(u: FirebaseUser): AuthUser {
  return { id: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL };
}

// ─── State ───────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  isSigningIn: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  profile: null,
  isSigningIn: false,
  error: null,
};

// ─── Subscription references (module-scoped, not exported) ────

let _authUnsubscribe: (() => void) | null = null;
let _visibilityListener: (() => void) | null = null;

// ─── Store ───────────────────────────────────────────────────

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ user, profile }) => ({
    isAuthenticated: computed(() => user() !== null),
    isSuperadmin: computed(() => profile()?.role === 'superadmin'),
    displayName: computed(() => user()?.displayName ?? profile()?.username ?? null),
    avatarUrl: computed(() => user()?.photoURL ?? profile()?.avatar_url ?? null),
  })),

  withMethods((store) => {
    const authRepo = inject(AuthRepository);
    const router = inject(Router);

    async function loadForUser(firebaseUser: FirebaseUser): Promise<void> {
      const authUser = toAuthUser(firebaseUser);
      const { data: profile } = await authRepo.getProfile(authUser.id);
      patchState(store, { user: authUser, profile });
    }

    return {
      async initialize(): Promise<void> {
        // Firebase Auth restaura la sesión persistida de forma asíncrona — en
        // una recarga de página `auth.currentUser` todavía es `null` en este
        // punto aunque exista una sesión válida en IndexedDB. Hay que esperar
        // a que dispare el primer `onAuthStateChanged` antes de dejar que
        // APP_INITIALIZER desbloquee el bootstrap; si no, los guards
        // (isAuthenticated()) corren con el store todavía vacío y redirigen a
        // /auth/login pese a que el usuario sí está logueado.
        await new Promise<void>((resolveFirst) => {
          let isFirstEmission = true;
          const { unsubscribe } = authRepo.onAuthStateChange(async (firebaseUser) => {
            try {
              if (firebaseUser) {
                await loadForUser(firebaseUser);
              } else {
                patchState(store, { user: null, profile: null });
              }
            } catch {
              // Swallow so APP_INITIALIZER always resolves
            } finally {
              if (isFirstEmission) {
                isFirstEmission = false;
                resolveFirst();
              }
            }
          });
          _authUnsubscribe = unsubscribe;
        });

        // Al volver a la pestaña, releer auth.currentUser (Firebase SDK ya
        //    refresca el token en background; esto solo resincroniza el signal
        //    si el timer estuvo throttled mientras la pestaña estaba oculta).
        _visibilityListener = () => {
          if (document.visibilityState !== 'visible') return;
          const current = auth.currentUser;
          if (current && current.uid !== store.user()?.id) {
            loadForUser(current);
          } else if (!current && store.user()) {
            patchState(store, { user: null, profile: null });
          }
        };
        document.addEventListener('visibilitychange', _visibilityListener);
      },

      async signInWithGoogle(): Promise<void> {
        patchState(store, { isSigningIn: true, error: null });
        try {
          await authRepo.signInWithGoogle();
          // Éxito: onAuthStateChange (suscripto en initialize()) ya actualiza
          // user/profile — solo resta bajar el flag de carga acá.
          patchState(store, { isSigningIn: false });
        } catch (e) {
          // El usuario puede cerrar el popup (auth/popup-closed-by-user) — no
          // es un error real, no mostramos toast en ese caso.
          const code = (e as { code?: string }).code;
          patchState(store, {
            isSigningIn: false,
            error: code === 'auth/popup-closed-by-user' ? null : 'Error al conectar con Google',
          });
        }
      },

      async signInWithGoogleIdToken(idToken: string): Promise<void> {
        patchState(store, { isSigningIn: true, error: null });
        try {
          await authRepo.signInWithGoogleIdToken(idToken);
          patchState(store, { isSigningIn: false });
        } catch {
          patchState(store, { isSigningIn: false, error: 'Error al conectar con Google' });
        }
      },

      signOut(): void {
        patchState(store, { user: null, profile: null, error: null });
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        authRepo.signOut().catch(() => {});
        router.navigate(['/']);
      },

      async updateProfile(updates: { username?: string }): Promise<boolean> {
        const userId = store.user()?.id;
        if (!userId) return false;
        try {
          const { data: profile, error } = await authRepo.updateProfile(userId, updates);
          if (error) return false;
          patchState(store, { profile });
          return true;
        } catch {
          return false;
        }
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),

  withHooks(() => ({
    onInit() {
      // Intentionally empty — APP_INITIALIZER calls store.initialize()
    },
    onDestroy() {
      _authUnsubscribe?.();
      if (_visibilityListener) {
        document.removeEventListener('visibilitychange', _visibilityListener);
        _visibilityListener = null;
      }
    },
  })),
);

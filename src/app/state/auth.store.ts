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
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../data/database.types';
import { AuthRepository } from '../data/repositories/auth.repository';

// ─── State ───────────────────────────────────────────────────

interface AuthState {
  user: User | null;
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

// ─── Helpers ─────────────────────────────────────────────────

async function syncGoogleNames(
  user: User,
  profile: Profile | null,
  authRepo: AuthRepository,
): Promise<void> {
  if (user.app_metadata?.['provider'] !== 'google') return;
  if (profile?.first_name || profile?.last_name) return;
  const meta = user.user_metadata ?? {};
  let firstName = (meta['given_name'] as string) || null;
  let lastName = (meta['family_name'] as string) || null;
  if (!firstName && !lastName) {
    const full = (meta['full_name'] as string) || (meta['name'] as string) || '';
    const parts = full.trim().split(/\s+/);
    firstName = parts[0] || null;
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  }
  await authRepo.updateProfile(user.id, { first_name: firstName, last_name: lastName });
}

// ─── Subscription reference (module-scoped, not exported) ────

let _authSubscription: { unsubscribe(): void } | null = null;

// ─── Store ───────────────────────────────────────────────────

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ user, profile }) => ({
    isAuthenticated: computed(() => user() !== null),
    isSuperadmin: computed(() => profile()?.role === 'superadmin'),
    displayName: computed(() => {
      const u = user();
      if (!u) return null;
      if (u.app_metadata?.['provider'] === 'google') {
        return (
          (u.user_metadata?.['full_name'] as string) ??
          (u.user_metadata?.['name'] as string) ??
          null
        );
      }
      return profile()?.username ?? null;
    }),
    avatarUrl: computed(() => {
      const u = user();
      if (u?.app_metadata?.['provider'] === 'google') {
        return (
          (u.user_metadata?.['avatar_url'] as string) ??
          (u.user_metadata?.['picture'] as string) ??
          null
        );
      }
      return null;
    }),
  })),

  withMethods((store) => {
    const authRepo = inject(AuthRepository);
    const router = inject(Router);

    return {
      async initialize(): Promise<void> {
        // 1. Load initial session — always resolves, never throws
        try {
          const {
            data: { session },
          } = await authRepo.getSession();

          if (session?.user) {
            const { data: profile } = await authRepo.getProfile(session.user.id);
            patchState(store, { user: session.user, profile });
            syncGoogleNames(session.user, profile, authRepo);
          }
        } catch {
          // Swallow errors so APP_INITIALIZER always resolves
        }

        // 2. Subscribe to subsequent auth state changes
        const { data } = authRepo.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            const { data: profile } = await authRepo.getProfile(session.user.id);
            // SIGNED_IN always wins (new login — store.user() is null at this point for OAuth).
            // For other events (TOKEN_REFRESHED, USER_UPDATED) only update if the user
            // hasn't signed out while getProfile was in-flight.
            if (event === 'SIGNED_IN' || store.user()) {
              patchState(store, { user: session.user, profile });
            }
            if (event === 'SIGNED_IN') {
              syncGoogleNames(session.user, profile, authRepo);
            }
          } else {
            patchState(store, { user: null, profile: null });
          }
        });

        _authSubscription = data.subscription;
      },

      async signInWithGoogle(): Promise<void> {
        patchState(store, { isSigningIn: true, error: null });
        const { error } = await authRepo.signInWithGoogle();
        if (error) {
          patchState(store, { isSigningIn: false, error: 'Error al conectar con Google' });
        }
        // No error: browser redirects to OAuth — isSigningIn stays true until page unloads
      },

      signOut(): void {
        // Clear local storage keys that Supabase uses for session persistence
        // so the session is gone even if the network call fails
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-'))
          .forEach((k) => localStorage.removeItem(k));
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
      _authSubscription?.unsubscribe();
    },
  })),
);

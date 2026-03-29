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
import type { LoginDto, RegisterDto } from '../data/repositories/auth.repository';
import { AuthRepository } from '../data/repositories/auth.repository';

// ─── State ───────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  profile: null,
  isLoading: true,
  error: null,
};

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
      async loadSession(): Promise<void> {
        const {
          data: { session },
        } = await authRepo.getSession();

        if (session?.user) {
          const { data: profile } = await authRepo.getProfile(session.user.id);
          patchState(store, { user: session.user, profile, isLoading: false });
        } else {
          patchState(store, { isLoading: false });
        }
      },

      updateAuthState(user: User | null, profile: Profile | null): void {
        patchState(store, { user, profile });
      },

      async signInWithEmail(dto: LoginDto): Promise<boolean> {
        patchState(store, { isLoading: true, error: null });
        try {
          const { data, error } = await authRepo.signInWithPassword(dto);
          if (error) {
            patchState(store, { isLoading: false, error: 'Email o contraseña incorrectos' });
            return false;
          }
          if (data.user) {
            const { data: profile } = await authRepo.getProfile(data.user.id);
            patchState(store, { user: data.user, profile, isLoading: false });
            router.navigate([profile?.role === 'superadmin' ? '/admin' : '/app']);
          }
          return true;
        } catch {
          patchState(store, { isLoading: false, error: 'Error al iniciar sesión' });
          return false;
        }
      },

      async signUp(dto: RegisterDto): Promise<boolean> {
        patchState(store, { isLoading: true, error: null });
        try {
          const { data, error } = await authRepo.signUp(dto);
          if (error) {
            patchState(store, {
              isLoading: false,
              error: error.message.includes('already registered')
                ? 'Este email ya está registrado'
                : 'Error al registrarse',
            });
            return false;
          }
          // Si no requiere confirmación de email, el usuario ya está logueado
          if (data.session) {
            const { data: profile } = await authRepo.getProfile(data.user!.id);
            patchState(store, { user: data.user, profile, isLoading: false });
            router.navigate(['/app']);
          } else {
            // Requiere confirmación de email
            patchState(store, { isLoading: false });
          }
          return true;
        } catch {
          patchState(store, { isLoading: false, error: 'Error al registrarse' });
          return false;
        }
      },

      async signInWithGoogle(): Promise<void> {
        patchState(store, { error: null });
        const { error } = await authRepo.signInWithGoogle();
        if (error) patchState(store, { error: 'Error al conectar con Google' });
      },

      async signInWithMagicLink(email: string): Promise<boolean> {
        patchState(store, { isLoading: true, error: null });
        try {
          const { error } = await authRepo.signInWithMagicLink(email);
          if (error) {
            patchState(store, { isLoading: false, error: 'No se pudo enviar el magic link' });
            return false;
          }
          patchState(store, { isLoading: false });
          return true;
        } catch {
          patchState(store, { isLoading: false, error: 'Error al enviar el magic link' });
          return false;
        }
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

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),

  withHooks((store) => {
    const authRepo = inject(AuthRepository);
    let subscription: { unsubscribe(): void } | null = null;

    return {
      onInit() {
        store.loadSession();

        const { data } = authRepo.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            const { data: profile } = await authRepo.getProfile(session.user.id);
            // SIGNED_IN always wins (new login — store.user() is null at this point for OAuth).
            // For other events (TOKEN_REFRESHED, USER_UPDATED) only update if the user
            // hasn't signed out while getProfile was in-flight.
            if (event === 'SIGNED_IN' || store.user()) {
              store.updateAuthState(session.user, profile);
            }
          } else {
            store.updateAuthState(null, null);
          }
        });

        subscription = data.subscription;
      },
      onDestroy() {
        subscription?.unsubscribe();
      },
    };
  }),
);

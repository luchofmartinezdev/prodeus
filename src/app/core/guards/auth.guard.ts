import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore, sessionReady } from '../../state/auth.store';

export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Esperar a que el store termine de verificar la sesión inicial
  if (authStore.isLoading()) {
    await sessionReady;
  }

  if (authStore.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

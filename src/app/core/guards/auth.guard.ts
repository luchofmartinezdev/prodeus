import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';

export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Esperar a que el store termine de verificar la sesión inicial
  if (authStore.isLoading()) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!authStore.isLoading()) return resolve();
        setTimeout(check, 30);
      };
      check();
    });
  }

  if (authStore.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

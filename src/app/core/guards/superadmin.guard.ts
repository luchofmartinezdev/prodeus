import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';

export const superadminGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isLoading()) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!authStore.isLoading()) return resolve();
        setTimeout(check, 30);
      };
      check();
    });
  }

  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  if (!authStore.isSuperadmin()) return router.createUrlTree(['/app']);
  return true;
};

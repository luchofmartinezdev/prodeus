import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';

export const superadminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  if (!authStore.isSuperadmin()) return router.createUrlTree(['/app']);
  return true;
};

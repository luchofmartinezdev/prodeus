import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { PendingInviteService } from '../services/pending-invite.service';

/** Sin sesión, recuerda la invitación y manda al login. */
export const inviteGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const pendingInvite = inject(PendingInviteService);

  if (authStore.isAuthenticated()) return true;
  pendingInvite.save(route.paramMap.get('code') ?? '');
  return router.createUrlTree(['/auth/login']);
};

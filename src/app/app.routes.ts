import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { inviteGuard } from './core/guards/invite.guard';
import { superadminGuard } from './core/guards/superadmin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [superadminGuard],
    // Fase 4: loadChildren apuntará al módulo admin completo
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    // Fase 5+: loadChildren apuntará al módulo usuario completo
    loadChildren: () => import('./features/user/user.routes').then((m) => m.USER_ROUTES),
  },
  {
    path: 'unirse/:code',
    canActivate: [inviteGuard],
    loadComponent: () =>
      import('./features/invite/join-invite.component').then((m) => m.JoinInviteComponent),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];

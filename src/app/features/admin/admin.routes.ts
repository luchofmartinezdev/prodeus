import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'tournaments', pathMatch: 'full' },
      {
        path: 'tournaments',
        loadComponent: () =>
          import('./tournaments/tournament-list/tournament-list.component').then(
            (m) => m.TournamentListComponent,
          ),
      },
      {
        path: 'tournaments/new',
        loadComponent: () =>
          import('./tournaments/tournament-form/tournament-form.component').then(
            (m) => m.TournamentFormComponent,
          ),
      },
      {
        path: 'tournaments/:id',
        loadComponent: () =>
          import('./tournaments/tournament-detail/tournament-detail.component').then(
            (m) => m.TournamentDetailComponent,
          ),
      },
      {
        path: 'tournaments/:id/edit',
        loadComponent: () =>
          import('./tournaments/tournament-form/tournament-form.component').then(
            (m) => m.TournamentFormComponent,
          ),
      },
      {
        path: 'rules',
        loadComponent: () => import('./rules/rules.component').then((m) => m.AdminRulesComponent),
      },
      {
        path: 'stats',
        loadComponent: () => import('./stats/stats.component').then((m) => m.AdminStatsComponent),
      },
    ],
  },
];

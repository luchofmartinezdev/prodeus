import { Routes } from '@angular/router';
import { UserLayoutComponent } from './layout/user-layout.component';

export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./groups/group-list/group-list.component').then((m) => m.GroupListComponent),
      },
      {
        path: 'groups/new',
        loadComponent: () =>
          import('./groups/group-form/group-form.component').then((m) => m.GroupFormComponent),
      },
      {
        path: 'groups/:id',
        loadComponent: () =>
          import('./groups/group-detail/group-detail.component').then(
            (m) => m.GroupDetailComponent,
          ),
      },
      {
        path: 'groups/:id/predictions',
        loadComponent: () =>
          import('./predictions/predictions.component').then((m) => m.PredictionsComponent),
      },
      {
        path: 'groups/:id/ranking',
        loadComponent: () => import('./ranking/ranking.component').then((m) => m.RankingComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('../../features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
];

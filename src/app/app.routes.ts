import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home';
import { LoginComponent } from './features/auth/login/login';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout';
import { authGuard, adminGuard } from './core/guards/auth-guard';


export const routes: Routes = [
    {
        path: '',
        component: HomeComponent
    },
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
    },
    {
        path: '',
        component: MainLayoutComponent,
        canActivateChild: [authGuard],
        children: [
            {
                path: 'admin-panel',
                canActivate: [adminGuard],
                loadComponent: () =>
                    import('./features/admin-panel/admin-panel')
                        .then(m => m.AdminPanelComponent)
            },

            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./features/dashboard/dashboard')
                        .then(m => m.DashboardComponent)
            },

            {
                path: 'predictions',
                loadComponent: () =>
                    import('./features/predictions/predictions')
                        .then(m => m.PredictionsComponent)
            },

            {
                path: 'leaderboard',
                loadComponent: () =>
                    import('./features/leaderboard/leaderboard')
                        .then(m => m.LeaderboardComponent)
            },

            {
                path: 'profile',
                loadComponent: () =>
                    import('./features/profile/profile')
                        .then(m => m.ProfileComponent)
            },
            {
                path: 'rules',
                loadComponent: () =>
                    import('./features/rules/rules')
                        .then(m => m.RulesComponent)
            }

        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
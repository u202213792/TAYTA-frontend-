import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { planGuard } from './core/guards/plan.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  {
    path: 'inicio',
    loadComponent: () => import('./features/landing/landing'),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login/login'),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register/register').then((m) => m.Register),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard'),
      },
      {
        path: 'elderly',
        canActivate: [planGuard],
        loadComponent: () => import('./features/elderly/elderly-list'),
      },
      {
        path: 'elderly/new',
        canActivate: [planGuard],
        loadComponent: () => import('./features/elderly/elderly-detail'),
      },
      {
        path: 'elderly/:id',
        canActivate: [planGuard],
        loadComponent: () => import('./features/elderly/elderly-detail'),
      },
      {
        path: 'health-centers',
        canActivate: [planGuard],
        loadComponent: () => import('./features/health-centers/health-centers'),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/users/users-list'),
      },
      {
        path: 'nurses',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/nurses/nurses'),
      },
      {
        path: 'monitoring',
        canActivate: [planGuard],
        loadComponent: () => import('./features/monitoring/monitoring'),
      },
      {
        path: 'calendar',
        canActivate: [planGuard],
        loadComponent: () => import('./features/calendar/calendar'),
      },
      {
        path: 'subscription',
        loadComponent: () => import('./features/subscription/subscription'),
      },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];

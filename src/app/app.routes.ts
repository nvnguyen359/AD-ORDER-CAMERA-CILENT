import { Routes } from '@angular/router';

export const routes: Routes = [

  { path: '', loadComponent: () => import('./pages/auth-page/auth-page').then((m) => m.AuthPage) },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history').then((m) => m.History),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/setting/setting').then((m) => m.Setting),
  },
   {
    path: 'monitor',
    loadComponent: () => import('./pages/monitor/monitor').then((m) => m.Monitor),
  }
];

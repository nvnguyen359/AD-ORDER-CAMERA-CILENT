import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AuthComponent } from './components/auth-component/auth-component';
import { OrderDetailComponent } from './components/order-detail.component/order-detail.component';
import {  CamerasPage } from './pages/cameras/cameras';
import { UsersPageComponent } from './pages/users-page/users-page';


export const routes: Routes = [

  { path: 'login', loadComponent: () => import('./pages/auth-page/auth-page').then((m) => m.AuthPage) },
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
    loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsComponent),
    canActivate: [authGuard]
  },
   {
    path: '',
    loadComponent: () => import('./pages/monitor/monitor').then((m) => m.MonitorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    component: AuthComponent,
    canActivate: [authGuard]
  },
   {
    path: 'users',
    component: UsersPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'order-detail/:code', // :code là tham số động
    component: OrderDetailComponent
  },{
    path:'cameras',
    component: CamerasPage,
    canActivate: [authGuard]
  }
];

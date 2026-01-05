import { Routes } from '@angular/router';
import { SettingsComponent } from './pages/settings/settings';
import { authGuard } from './core/guards/auth.guard';
import { AuthComponent } from './components/auth-component/auth-component';
import { OrderDetailComponent } from './components/order-detail.component/order-detail.component';
import { CamerasComponent } from './components/cameras.component/cameras.component';

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
  },
   {
    path: '',
    loadComponent: () => import('./pages/monitor/monitor').then((m) => m.MonitorComponent),
  },
  {
    path: 'admin',
    component: AuthComponent,
    canActivate: [authGuard]
  },
  {
    path: 'order-detail/:code', // :code là tham số động
    component: OrderDetailComponent
  },{
    path:'camera',
    component: CamerasComponent,
    canActivate: [authGuard]
  }
];

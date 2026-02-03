import { CommonModule } from '@angular/common';
import { Component, ViewChild, signal } from '@angular/core';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
// [1] Import đầy đủ animation functions
import { trigger, transition, style, animate, query, stagger, animateChild, group } from '@angular/animations';

import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { menuItems } from './Menu';
import { AuthService } from './core/services/auth.service';
import { BoxSearchComponent } from './components/box-search.component/box-search.component';
import { OrderService } from './core/services/order.service';
import { SystemMonitorComponent } from './components/system-monitor.component/system-monitor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterModule,
    CommonModule,
    BadgeModule,
    AvatarModule,
    InputTextModule,
    DrawerModule,
    ButtonModule,
    ToastModule,
    BoxSearchComponent,SystemMonitorComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],

  // [CẤU HÌNH ANIMATION SIÊU MƯỢT]
  animations: [
    trigger('menuAnimation', [
      transition(':enter', [
        // 1. Trạng thái ban đầu của cả khối: Ẩn, tụt xuống 15px, thu nhỏ nhẹ
        style({ opacity: 0, transform: 'translateY(15px) scale(0.95)' }),

        // 2. Chạy Animation cho cả khối (Nảy nhẹ: cubic-bezier)
        group([
          animate('250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            style({ opacity: 1, transform: 'translateY(0) scale(1)' })),

          // 3. Tìm các item con (.popup-item) để chạy hiệu ứng xuất hiện lần lượt
          query('.popup-item', [
            style({ opacity: 0, transform: 'translateX(-10px)' }),
            stagger(50, [
              animate('250ms ease-out',
                style({ opacity: 1, transform: 'translateX(0)' }))
            ])
          ], { optional: true })
        ])
      ]),

      transition(':leave', [
        // Khi đóng: Biến mất nhanh và mượt (ease-in)
        animate('200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: 0, transform: 'translateY(10px) scale(0.95)' }))
      ])
    ])
  ]
})
export class App {
  protected readonly title = signal('AD-ORDER-CAMERA-CLIENT');
  visible = false;
  isSpeedDialOpen = false;

  menuItems = menuItems;

  @ViewChild(BoxSearchComponent) boxSearch!: BoxSearchComponent;

  constructor(
    public router: Router,
    public authService: AuthService,
    private messageService: MessageService,
    private orderService: OrderService
  ) {}

  private get moreIndex() {
    return this.menuItems.findIndex(item => item.label === 'More');
  }

  get drawerMenuItems() {
    const isAuth = this.authService.isAuthenticated();
    return this.menuItems.filter(item => {
      if (!item.label || item.label === 'More') return false;
      if (item.label === 'Login' && isAuth) return false;
      if (item.label === 'Logout' && !isAuth) return false;
      return true;
    });
  }

  get mobilePrimaryItems() {
    const index = this.moreIndex;
    return index === -1 ? this.menuItems : this.menuItems.slice(0, index);
  }

  get speedDialItems() {
    const isAuth = this.authService.isAuthenticated();
    const index = this.moreIndex;
    if (index === -1) return [];

    return this.menuItems
      .slice(index + 1)
      .filter(item => {
        if (item.label === 'Login' && isAuth) return false;
        if (item.label === 'Logout' && !isAuth) return false;
        return true;
      });
  }

  toggleSpeedDial() {
    this.isSpeedDialOpen = !this.isSpeedDialOpen;
  }

  handleSpeedDialClick(item: any) {
    // Đóng menu chậm lại 1 chút để người dùng kịp thấy hiệu ứng click (ripple)
    setTimeout(() => {
        this.isSpeedDialOpen = false;
    }, 150);

    if (item.label === 'Logout') {
      this.authService.logout();
    } else if (item.routerLink) {
      this.router.navigate([item.routerLink]);
    }
  }

  handleMenuClick(event: Event, item: any) {
    this.visible = false;
    if (item.icon && item.icon.includes('pi-qrcode')) {
      event.preventDefault();
      if (this.boxSearch) {
        this.boxSearch.showQrDialog = true;
      }
    }
  }
}

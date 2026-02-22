import { CommonModule } from '@angular/common';
import { Component, ViewChild, signal, OnInit, OnDestroy, inject } from '@angular/core'; // [UPDATE] Thêm OnInit, OnDestroy, inject
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
import { SettingsService } from './core/services/settings.service'; // [UPDATE] Import Service
import { BoxSearchComponent } from './components/box-search.component/box-search.component';
import { OrderService } from './core/services/order.service';
import { SystemMonitorComponent } from './components/system-monitor.component/system-monitor.component';
import { SystemControlComponent } from './components/system-control.component/system-control.component';

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
    BoxSearchComponent,
    SystemMonitorComponent,
    SystemControlComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],

  // [CẤU HÌNH ANIMATION SIÊU MƯỢT]
  animations: [
    trigger('menuAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px) scale(0.95)' }),
        group([
          animate('250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
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
        animate('200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: 0, transform: 'translateY(10px) scale(0.95)' }))
      ])
    ])
  ]
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('AD-ORDER-CAMERA-CLIENT');
  visible = false;
  isSpeedDialOpen = false;

  menuItems = menuItems;

  // [LOGIC MỚI] Xử lý thông báo hết giờ
  private settingsService = inject(SettingsService);
  isOverTime = signal(false); // Signal điều khiển hiển thị banner
  workEndTimeDisplay = signal(''); // Hiển thị giờ nghỉ lên UI
  private timeCheckInterval: any;

  @ViewChild(BoxSearchComponent) boxSearch!: BoxSearchComponent;

  constructor(
    public router: Router,
    public authService: AuthService,
    private messageService: MessageService,
    private orderService: OrderService
  ) {}

  // [INIT] Khởi tạo check giờ
  ngOnInit() {
    this.checkWorkTime();
  }

  // [DESTROY] Dọn dẹp interval khi component hủy
  ngOnDestroy() {
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
    }
  }

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

  // [HÀM MỚI] Kiểm tra giờ làm việc từ Settings
  checkWorkTime() {
    this.settingsService.getSettings().subscribe({
      next: (data: any) => {
        const endTimeStr = data['work_end_time']; // Ví dụ "17:30"

        if (endTimeStr) {
          this.workEndTimeDisplay.set(endTimeStr);

          // 1. Kiểm tra ngay lập tức
          this.compareTime(endTimeStr);

          // 2. Tạo vòng lặp kiểm tra mỗi 60 giây
          this.timeCheckInterval = setInterval(() => {
            this.compareTime(endTimeStr);
          }, 5000);
        }
      },
      error: () => console.warn('Không tải được cấu hình giờ làm việc')
    });
  }

  // [HÀM MỚI] So sánh thời gian
  compareTime(endTimeStr: string) {
    if (!endTimeStr) return;

    const now = new Date();
    const [hours, minutes] = endTimeStr.split(':').map(Number);

    // Tạo đối tượng Date cho giờ nghỉ hôm nay
    const limit = new Date();
    limit.setHours(hours, minutes, 0, 0);

    // Nếu hiện tại >= giờ nghỉ -> Bật thông báo
    if (now >= limit) {
      this.isOverTime.set(true);
    } else {
      this.isOverTime.set(false);
    }
  }
}

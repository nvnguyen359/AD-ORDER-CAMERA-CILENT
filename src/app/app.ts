import { CommonModule } from '@angular/common';
import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
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
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  protected readonly title = signal('AD-ORDER-CAMERA-CLIENT');
  visible = false;
  menuItems = menuItems;
  isShowFilter: boolean = false;

  @ViewChild(BoxSearchComponent) boxSearch!: BoxSearchComponent;

  constructor(
    public router: Router,
    private authService: AuthService,
    private messageService: MessageService,
    private orderService: OrderService
  ) {
    if (!this.authService.checkTokenIsValid()) {
      // Logic redirect...
    }
  }

  ngOnInit() {}

  handleMenuClick(event: Event, item: any) {
    this.visible = false; // Đóng menu

    // [SỬA LỖI QUAN TRỌNG] Dùng includes() thay vì === vì icon của bạn là 'pi pi-qrcode btn-ac'
    if (item.icon && item.icon.includes('pi-qrcode')) {

      console.log('Detected QR Click!'); // Log để kiểm tra
      event.preventDefault();
      event.stopPropagation();

      if (this.boxSearch) {
        this.boxSearch.showQrDialog = true;
      } else {
        console.error('Không tìm thấy BoxSearchComponent!');
        this.messageService.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không mở được Camera. Vui lòng tải lại.'
        });
      }
    }
  }
}

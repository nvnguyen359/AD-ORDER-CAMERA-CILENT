import { Component, inject, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemService } from '../../core/services/system.service';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-system-control',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    ToggleSwitchModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './system-control.component.html',
  styleUrls: ['./system-control.component.scss']
})
export class SystemControlComponent {
  private systemService = inject(SystemService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  // Tham số tùy chỉnh giao diện: Mặc định là false (hiển thị đầy đủ)
  compactMode = input<boolean>(false);

  // Các state hiện tại
  isHotspotActive = signal(false);
  isLoading = signal(false);

  confirmReboot() {
    this.confirmationService.confirm({
      message: 'Hệ thống sẽ mất kết nối trong vài phút. Bạn có muốn tiếp tục?',
      header: 'Xác nhận Khởi động lại',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      acceptLabel: 'Đồng ý',
      rejectLabel: 'Hủy',
      accept: () => {
        this.systemService.reboot().subscribe({
          next: (res: any) => this.messageService.add({ severity: 'info', summary: 'Thông báo', detail: res.message }),
          error: (err: any) => this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể khởi động lại' })
        });
      }
    });
  }

  onHotspotToggle(event: any) {
    const isChecked = event.checked;
    const action = isChecked ? 'on' : 'off';
    
    this.isHotspotActive.set(isChecked);
    this.isLoading.set(true);

    this.systemService.toggleHotspot(action).subscribe({
      next: (res: any) => {
        this.messageService.add({ severity: 'success', summary: 'Hotspot', detail: res.message });
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Thao tác thất bại' });
        this.isHotspotActive.set(!isChecked);
        this.isLoading.set(false);
      }
    });
  }

  // Xử lý khi click trực tiếp vào Icon Hotspot (ở chế độ compact)
  toggleHotspotManual() {
    if (this.isLoading()) return; 
    const newState = !this.isHotspotActive();
    this.onHotspotToggle({ checked: newState });
  }
}
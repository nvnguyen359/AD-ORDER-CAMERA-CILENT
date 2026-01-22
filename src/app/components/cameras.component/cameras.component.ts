import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CameraService } from '../../core/services/camera.service';
import { AuthService } from '../../core/services/auth.service';
import { MonitorCamera } from '../../core/models/monitor-camera.model';

@Component({
  selector: 'app-cameras-component',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, DialogModule, InputTextModule, ToastModule, ConfirmDialogModule, TooltipModule, SkeletonModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './cameras.component.html',
  styleUrls: ['./cameras.component.scss']
})
export class CamerasComponent implements OnInit {
  private cameraService = inject(CameraService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  public authService = inject(AuthService);

  cameras = signal<MonitorCamera[]>([]);
  loading = signal<boolean>(true);
  showEditDialog = false;
  selectedCamera: MonitorCamera | null = null;
  newDisplayName: string = '';
  isSaving = false;

  ngOnInit() { this.loadCameras(); }

  loadCameras() {
    this.loading.set(true);
    this.cameraService.getAllCameras().subscribe({
      next: (res) => {
        if (res.data) this.cameras.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // Mở Dialog Edit
  openEditDialog(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
    this.selectedCamera = cam;
    this.newDisplayName = cam.display_name || cam.name;
    this.showEditDialog = true;
  }

  // Lưu tên mới
  saveCameraName() {
    if (!this.selectedCamera) return;
    this.isSaving = true;
    this.cameraService.updateCamera(this.selectedCamera.id, { display_name: this.newDisplayName }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Thành công', detail: 'Đã đổi tên camera' });
        this.showEditDialog = false;
        this.isSaving = false;
        this.loadCameras();
      },
      error: () => { this.isSaving = false; }
    });
  }

  // [FIX] Điều khiển Connect/Disconnect
  toggleConnection(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
    // Chuyển đổi linh hoạt giữa 1/0 và true/false
    const isConnected = Number(cam.is_connected) === 1;
    const action = isConnected ? 'Ngắt kết nối' : 'Kết nối lại';

    this.confirmationService.confirm({
      message: `Bạn muốn <b>${action}</b> camera ${cam.display_name || cam.name}?`,
      header: 'Xác nhận',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        const api = isConnected ? this.cameraService.disconnectCamera(cam.id) : this.cameraService.connectCamera(cam.id);

        api.subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Thành công', detail: `Đã ${action}` });

            // [FIX LỖI TS] Cập nhật trực tiếp vào Signal để UI đổi màu ngay
            this.cameras.update(currentList => {
                return currentList.map(c => {
                    if (c.id === cam.id) {
                        return {
                            ...c,
                            is_connected: isConnected ? 0 : 1, // Đảo trạng thái
                            // [FIX] Ép kiểu as any để tránh lỗi TypeScript do Model chưa khai báo 'DISCONNECTED'
                            recording_state: (isConnected ? 'DISCONNECTED' : 'IDLE') as any
                        };
                    }
                    return c;
                });
            });
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể thực hiện hành động.' });
          }
        });
      }
    });
  }

  getSeverity(isConnected: any) {
      // Fix check cả số 1 và boolean true
      return (isConnected === 1 || isConnected === true) ? 'success' : 'danger';
  }
}

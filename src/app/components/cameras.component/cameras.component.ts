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
  selector: 'app-cameras',
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

  // Điều khiển Connect/Disconnect
  toggleConnection(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
    const isConnected = !!cam.is_connected;
    const action = isConnected ? 'Ngắt kết nối' : 'Kết nối lại';

    this.confirmationService.confirm({
      message: `Bạn muốn <b>${action}</b> camera ${cam.display_name || cam.name}?`,
      header: 'Xác nhận',
      accept: () => {
        const api = isConnected ? this.cameraService.disconnectCamera(cam.id) : this.cameraService.connectCamera(cam.id);
        api.subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Thành công', detail: `Đã ${action}` });
            this.loadCameras();
          }
        });
      }
    });
  }

  getSeverity(isConnected: any) { return isConnected ? 'success' : 'danger'; }
}

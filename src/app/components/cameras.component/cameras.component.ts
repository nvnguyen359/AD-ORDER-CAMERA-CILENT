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
import { RadioButtonModule } from 'primeng/radiobutton';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CameraService } from '../../core/services/camera.service';
import { AuthService } from '../../core/services/auth.service';
import { MonitorCamera } from '../../core/models/monitor-camera.model';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-cameras-component',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ButtonModule, 
    TagModule, 
    DialogModule, 
    InputTextModule, 
    ToastModule, 
    ConfirmDialogModule, 
    TooltipModule, 
    SkeletonModule, 
    RadioButtonModule
  ],
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

  // --- State: Action Buttons ---
  isScanning = false;

  // --- State: Live View ---
  showLiveViewDialog = false;
  liveViewUrl: string = '';
  liveViewCamName: string = '';

  // --- State: Add Camera ---
  showAddDialog = false;
  isAdding = false;
  newCameraForm = { type: 'LOCAL', name: '', device_path: '0', rtsp_url: '' };

  // --- State: Edit Camera ---
  showEditDialog = false;
  isSaving = false;
  selectedCamera: MonitorCamera | null = null;
  editForm = { name: '', rtsp_url: '', device_path: '' };

  ngOnInit() { 
    this.loadCameras(); 
  }

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

  // ==========================================
  // TỰ ĐỘNG DÒ TÌM CAMERA (AUTO DETECT)
  // ==========================================
  scanDevices() {
    this.isScanning = true;
    
    // Hiển thị thông báo để user biết hệ thống đang làm việc
    this.messageService.add({ 
      severity: 'info', 
      summary: 'Đang quét thiết bị', 
      detail: 'Hệ thống đang dò tìm các camera vật lý mới...', 
      life: 3000 
    });

    // Worker Backend (Python) chạy mỗi 5s, ta đợi 3.5s để đồng bộ DB rồi lấy kết quả mới
    setTimeout(() => {
      this.cameraService.getAllCameras().subscribe({
        next: (res) => {
          if (res.data) {
            const oldLength = this.cameras().length;
            this.cameras.set(res.data);
            
            const newLength = res.data.length;
            if (newLength > oldLength) {
              this.messageService.add({ severity: 'success', summary: 'Thành công', detail: `Đã tìm thấy ${newLength - oldLength} thiết bị mới!` });
            } else {
              this.messageService.add({ severity: 'success', summary: 'Hoàn tất', detail: 'Không tìm thấy thiết bị vật lý nào mới.' });
            }
          }
          this.isScanning = false;
        },
        error: () => {
          this.isScanning = false;
          this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể lấy dữ liệu thiết bị.' });
        }
      });
    }, 3500); 
  }

  // ==========================================
  // THÊM CAMERA MỚI THỦ CÔNG
  // ==========================================
  openAddDialog() {
    this.newCameraForm = { type: 'LOCAL', name: '', device_path: '0', rtsp_url: '' };
    this.showAddDialog = true;
  }

  saveNewCamera() {
    if (!this.newCameraForm.name.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng nhập tên camera!' });
      return;
    }

    const payload: any = {
      name: this.newCameraForm.name,
      display_name: this.newCameraForm.name
    };

    if (this.newCameraForm.type === 'LOCAL') {
      if (!this.newCameraForm.device_path) {
        this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng nhập Device Path hoặc Index!' });
        return;
      }
      payload.device_path = this.newCameraForm.device_path;
      payload.os_index = parseInt(this.newCameraForm.device_path) || 0;
    } else {
      if (!this.newCameraForm.rtsp_url) {
        this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng nhập đường dẫn RTSP!' });
        return;
      }
      payload.rtsp_url = this.newCameraForm.rtsp_url;
    }

    this.isAdding = true;
    this.cameraService.createCamera(payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Thành công', detail: 'Đã thêm camera mới.' });
        this.showAddDialog = false;
        this.isAdding = false;
        this.loadCameras();
      },
      error: () => {
        this.isAdding = false;
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể thêm camera.' });
      }
    });
  }

  // ==========================================
  // CHỈNH SỬA CAMERA (EDIT)
  // ==========================================
  openEditDialog(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
    this.selectedCamera = cam;
    this.editForm = {
      name: cam.display_name || cam.name,
      rtsp_url: cam.rtsp_url || '',
      device_path: cam.device_path || ''
    };
    this.showEditDialog = true;
  }

  saveCameraEdit() {
    if (!this.selectedCamera) return;
    this.isSaving = true;

    const payload: Partial<MonitorCamera> = {
      display_name: this.editForm.name,
      rtsp_url: this.editForm.rtsp_url,
      device_path: this.editForm.device_path
    };

    this.cameraService.updateCamera(this.selectedCamera.id, payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Thành công', detail: 'Đã cập nhật camera' });
        this.showEditDialog = false;
        this.isSaving = false;
        this.loadCameras(); 
      },
      error: () => { this.isSaving = false; }
    });
  }

  // ==========================================
  // XEM TRỰC TIẾP (LIVE VIEW)
  // ==========================================
  openLiveView(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
    if (!cam.is_connected) {
      this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Camera đang Offline, không thể xem.' });
      return;
    }
    this.liveViewCamName = cam.display_name || cam.name;
    // Thêm timestamp để ép tải lại khung hình stream mới
    this.liveViewUrl = `${environment.apiUrl}/cameras/${cam.id}/stream?t=${new Date().getTime()}`;
    this.showLiveViewDialog = true;
  }

  closeLiveView() {
    this.showLiveViewDialog = false;
    this.liveViewUrl = ''; // Ngắt url để dừng load ảnh ngầm
  }

  // ==========================================
  // KẾT NỐI & XÓA CAMERA
  // ==========================================
  toggleConnection(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
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
            this.loadCameras();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Thao tác thất bại. Vui lòng kiểm tra kết nối.' });
          }
        });
      }
    });
  }

  onDeleteCamera(cam: MonitorCamera, event: Event) {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: `Bạn có chắc chắn muốn xóa camera <b>${cam.display_name || cam.name}</b>?`,
      header: 'Xác nhận xóa',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger p-button-raised',
      accept: () => {
        this.cameraService.deleteCamera(cam.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Đã xóa', detail: 'Xóa thành công' });
            this.cameras.update(currentList => currentList.filter(c => c.id !== cam.id));
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xóa camera.' });
          }
        });
      }
    });
  }

  getSeverity(isConnected: any) {
    return (isConnected === 1 || isConnected === true) ? 'success' : 'danger';
  }
}
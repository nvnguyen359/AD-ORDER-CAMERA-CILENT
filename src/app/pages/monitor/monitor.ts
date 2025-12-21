import { Component, inject, OnDestroy, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../core/services/storage.service';
import { StreamService } from '../../core/services/stream.service';
import { environment } from '../../environments/environment';
import { CameraWidgetComponent } from '../../components/camera-widget.component/camera-widget.component';
import { FormsModule } from '@angular/forms'; // Cần cho binding select

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule, CameraWidgetComponent, FormsModule],
  templateUrl: './monitor.html',
  styleUrl: './monitor.scss',
})
export class Monitor implements OnInit, OnDestroy {
  private streamService = inject(StreamService);
  private storageService = inject(StorageService);

  // 1. Danh sách gốc từ API
  cameras = signal<any[]>([]);

  // 2. State cho Mobile
  isMobile = signal<boolean>(window.innerWidth < 768); // Mặc định check theo màn hình lúc load
  selectedCamId = signal<number | null>(null);

  // 3. Computed Signal: Tự động tính toán danh sách cần hiển thị
  // - Desktop: Trả về tất cả
  // - Mobile: Chỉ trả về mảng chứa 1 camera đang chọn
  visibleCameras = computed(() => {
    const allCams = this.cameras();
    const isMob = this.isMobile();
    const selectedId = this.selectedCamId();

    if (isMob && selectedId !== null) {
      return allCams.filter(c => c.id == selectedId);
    }
    return allCams;
  });

  // Lắng nghe resize để cập nhật isMobile
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isMobile.set(event.target.innerWidth < 768);
  }

  ngOnInit(): void {
    // Gọi API lấy list
    this.streamService.getCameras().subscribe({
      next: (res: any) => {
        const data = res.data || [];
        this.cameras.set(data);

        // Nếu có dữ liệu, mặc định chọn cam đầu tiên (cho mobile)
        if (data.length > 0) {
          this.selectedCamId.set(data[0].id);
        }
      },
      error: (err) => console.error('Failed to load cameras', err)
    });

    // Kết nối Socket tổng
    const token = this.storageService.getItem(environment.ACCESS_TOKEN_KEY);
    if (token) {
        this.streamService.connectSocket(token);
    }
  }

  // Hàm xử lý khi chọn Dropdown
  onCameraChange(event: any) {
    const val = event.target.value;
    this.selectedCamId.set(Number(val));
  }

  ngOnDestroy(): void {
    this.streamService.disconnectSocket();
  }
}

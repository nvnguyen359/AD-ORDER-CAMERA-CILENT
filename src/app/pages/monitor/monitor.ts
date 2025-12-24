import { Component, inject, OnDestroy, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Cần cho binding select

// Services
import { StorageService } from '../../core/services/storage.service';
import { StreamService } from '../../core/services/stream.service';
import { environment } from '../../environments/environment';

// Components
import { CameraWidgetComponent } from '../../components/camera-widget.component/camera-widget.component';
import { AnalysisResult } from '../../core/models/object-counter.model';
import { AiAnalysisDialogComponent } from '../../components/ai-analysis-dialog.component/ai-analysis-dialog.component';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [
    CommonModule,
    CameraWidgetComponent,
    FormsModule,
    AiAnalysisDialogComponent
  ],
  templateUrl: './monitor.html',
  styleUrl: './monitor.scss',
})
export class Monitor implements OnInit, OnDestroy {
  private streamService = inject(StreamService);
  private storageService = inject(StorageService);

  // 1. Danh sách gốc từ API
  cameras = signal<any[]>([]);

  // 2. State cho Mobile
  // Lưu ý: window.innerWidth chỉ chạy được trên Browser. Nếu dùng SSR cần check platform.
  // Nhưng nếu code cũ chạy ổn thì giữ nguyên.
  isMobile = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  selectedCamId = signal<number | null>(null);

  // 3. [MỚI] State cho Dialog Kết quả AI (Snapshot Counting)
  // Hai biến này cần thiết để file HTML binding vào [(visible)] và [result]
  analysisDialogVisible = false;
  analysisResult: AnalysisResult | null = null;

  // 4. Computed Signal: Tự động tính toán danh sách cần hiển thị
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

  // [MỚI] Hàm xử lý sự kiện từ Camera Widget bắn ra
  // File HTML đang gọi (onAnalysisComplete)="handleAnalysisComplete($event)" nên bắt buộc phải có hàm này
  handleAnalysisComplete(result: AnalysisResult) {
    console.log("Monitor received AI snapshot result:", result);
    this.analysisResult = result;
    this.analysisDialogVisible = true; // Mở Dialog lên
  }

  ngOnDestroy(): void {
    this.streamService.disconnectSocket();
  }
}

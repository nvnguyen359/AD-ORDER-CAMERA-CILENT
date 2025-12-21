import { Component, Input, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
// Import Model OrderInfo để định nghĩa kiểu dữ liệu cho đơn hàng
import { OrderInfo } from '../../core/models/monitor-camera.model';

@Component({
  selector: 'app-camera-widget',
  standalone: true,
  imports: [CommonModule, VisualizerDirective], // Import Directive vẽ AI
  templateUrl: './camera-widget.component.html',
  styleUrls: ['./camera-widget.component.scss']
})
export class CameraWidgetComponent implements OnInit, OnDestroy {
  // --- INPUTS ---
  @Input({ required: true }) cameraId!: number;   // ID Camera bắt buộc
  @Input() cameraName: string = 'Camera';        // Tên hiển thị

  // --- INJECTIONS ---
  private streamService = inject(StreamService);

  // Biến lưu subscription để hủy khi component bị destroy
  private sub: Subscription | null = null;

  // --- SIGNALS (STATE MANAGEMENT) ---
  // Trạng thái kết nối (True = đang nhận stream)
  isConnected = signal<boolean>(false);

  // Trạng thái đang ghi hình/có đơn hàng (True = hiện viền đỏ)
  isRecording = signal<boolean>(false);

  // [MỚI] Thông tin đơn hàng hiện tại (Mã vận đơn, nhân viên...)
  // Nếu null nghĩa là không có đơn hàng
  currentOrder = signal<OrderInfo | null>(null);

  // Dữ liệu ảnh Base64 để hiển thị
  imageBase64 = signal<string>('');

  // Dữ liệu AI Box (người, QR) để vẽ lên Canvas
  metadata = signal<any[]>([]);

  // Kích thước thật của ảnh (dùng để đồng bộ Canvas)
  imgWidth = 0;
  imgHeight = 0;

  // Tham chiếu đến thẻ div .viewport để xử lý Fullscreen
  @ViewChild('viewport') viewportRef!: ElementRef;

  // --- LIFECYCLE HOOKS ---

  ngOnInit(): void {
    // 1. Đăng ký nhận luồng dữ liệu RIÊNG của camera này
    // Hàm getCameraStream đã filter sẵn theo ID
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg: StreamMessage) => this.handleMessage(msg),
      error: (err) => console.error(`Cam ${this.cameraId} error:`, err)
    });

    // 2. Mặc định tự động kết nối khi Component được tạo
    this.connect();
  }

  ngOnDestroy(): void {
    // Hủy đăng ký khi tắt component để tránh rò rỉ bộ nhớ
    this.sub?.unsubscribe();
  }

  // --- LOGIC XỬ LÝ GÓI TIN SOCKET ---

  private handleMessage(msg: StreamMessage) {
    // A. Nếu là gói tin ảnh (Image Stream)
    if (msg.image) {
        this.isConnected.set(true);
        this.imageBase64.set(`data:image/jpeg;base64,${msg.image}`);
        // Cập nhật tọa độ vẽ AI (nếu có)
        this.metadata.set(msg.metadata || []);
    }

    // B. [NÂNG CẤP] Nếu là sự kiện Bắt đầu đơn hàng
    if (msg.event === 'ORDER_CREATED') {
        this.isRecording.set(true); // Bật viền đỏ

        // Lưu thông tin đơn hàng vào Signal để hiện Overlay
        if (msg.data) {
            this.currentOrder.set(msg.data);
        }
    }
    // C. [NÂNG CẤP] Nếu là sự kiện Kết thúc đơn hàng
    else if (msg.event === 'ORDER_STOPPED') {
        this.isRecording.set(false); // Tắt viền đỏ
        this.currentOrder.set(null); // Xóa thông tin đơn hàng
    }
  }

  // Sự kiện khi thẻ <img> load xong ảnh mới
  // Cần thiết để lấy kích thước thật (naturalWidth/Height) nhằm vẽ Canvas chuẩn xác
  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    // Chỉ cập nhật nếu kích thước thay đổi để tránh render thừa
    if (this.imgWidth !== img.naturalWidth || this.imgHeight !== img.naturalHeight) {
        this.imgWidth = img.naturalWidth;
        this.imgHeight = img.naturalHeight;
    }
  }

  // --- USER ACTIONS (Tương tác người dùng) ---

  // Gửi lệnh BẬT camera
  connect() {
    this.streamService.toggleCamera(this.cameraId, 'connect').subscribe();
  }

  // Gửi lệnh TẮT camera
  disconnect() {
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe(() => {
        // Reset toàn bộ UI về trạng thái chờ
        this.isConnected.set(false);
        this.isRecording.set(false);
        this.currentOrder.set(null); // [MỚI] Xóa thông tin đơn
        this.imageBase64.set('');
        this.metadata.set([]);
    });
  }

  // Đổi chế độ (Normal / Scan QR / Security)
  changeMode(event: Event) {
    const mode = (event.target as HTMLSelectElement).value;
    this.streamService.changeMode(this.cameraId, mode);
  }

  // Bật/Tắt toàn màn hình cho ô Camera này
  toggleFullscreen() {
    const elem = this.viewportRef.nativeElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch((err: any) => console.error('Fullscreen Error:', err));
    } else {
      document.exitFullscreen();
    }
  }
}

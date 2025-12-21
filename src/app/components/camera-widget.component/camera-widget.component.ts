import { Component, Input, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
// Import Model OrderInfo
import { OrderInfo } from '../../core/models/monitor-camera.model';

@Component({
  selector: 'app-camera-widget',
  standalone: true,
  imports: [CommonModule, VisualizerDirective],
  templateUrl: './camera-widget.component.html',
  styleUrls: ['./camera-widget.component.scss']
})
export class CameraWidgetComponent implements OnInit, OnDestroy {
  // --- INPUTS ---
  @Input({ required: true }) cameraId!: number;
  @Input() cameraName: string = 'Camera';

  // --- INJECTIONS ---
  private streamService = inject(StreamService);
  private sub: Subscription | null = null;

  // --- SIGNALS (STATE MANAGEMENT) ---

  // 1. isStreaming: True = Đang hiển thị video. False = Đang ẩn video.
  // (Thay thế cho isConnected cũ để đúng nghĩa hơn)
  isStreaming = signal<boolean>(false);

  // 2. isRecording: True = Server báo đang có đơn (hiện viền đỏ/Badge REC).
  isRecording = signal<boolean>(false);

  // 3. Thông tin đơn hàng hiện tại
  currentOrder = signal<OrderInfo | null>(null);

  // 4. Dữ liệu Stream
  imageBase64 = signal<string>('');
  metadata = signal<any[]>([]);

  // Kích thước thật của ảnh (dùng để đồng bộ Canvas AI)
  imgWidth = 0;
  imgHeight = 0;

  @ViewChild('viewport') viewportRef!: ElementRef;

  // --- LIFECYCLE HOOKS ---

  ngOnInit(): void {
    // 1. KẾT NỐI SOCKET NGAY LẬP TỨC
    // Luôn duy trì kết nối này để nhận tin nhắn ORDER_CREATED/ORDER_STOPPED
    // Kể cả khi user không xem video (isStreaming = false), socket vẫn phải sống.
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg: StreamMessage) => this.handleMessage(msg),
      error: (err) => console.error(`Cam ${this.cameraId} socket error:`, err)
    });

    // 2. Mặc định vào là bật xem luôn (hoặc tắt tùy bạn)
    this.connect();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // --- XỬ LÝ SOCKET ---

private handleMessage(msg: StreamMessage) {
    // 1. Nếu là Ảnh -> Chỉ xử lý, KHÔNG LOG (để đỡ rác console)
    if (msg.image) {
        if (this.isStreaming()) {
            this.imageBase64.set(`data:image/jpeg;base64,${msg.image}`);
            this.metadata.set(msg.metadata || []);
        }
        return; // <--- Return ngay, không chạy xuống dưới để log
    }

    // 2. Nếu là Sự kiện (Event) -> LOG MÀU ĐỂ DỄ THẤY
    if (msg.event) {
        console.log(`%c🔥 SOCKET EVENT: ${msg.event}`, 'background: #222; color: #bada55', msg.data);

        if (msg.event === 'ORDER_CREATED') {
            this.isRecording.set(true);
            if (msg.data) this.currentOrder.set(msg.data);
        }
        else if (msg.event === 'ORDER_STOPPED') {
            this.isRecording.set(false);
            this.currentOrder.set(null);
        }
        else if (msg.event === 'ORDER_UPDATED') {
             // ... logic update
        }
    } else {
        // Log những gói tin lạ (không phải ảnh, không phải event)
        console.warn('Gói tin không xác định:', msg);
    }
  }

  // --- USER ACTIONS ---

  // Nút "XEM LIVE" (Play)
  connect() {
    // 1. Bật hiển thị Client ngay lập tức
    this.isStreaming.set(true);

    // 2. Gọi API báo Server (Soft Connect)
    // Server sẽ update trạng thái 'Online' trong DB
    this.streamService.toggleCamera(this.cameraId, 'connect').subscribe({
        error: (err) => console.error(`Cam ${this.cameraId} connect failed`, err)
    });
  }

  // Nút "TẮT LIVE" (Stop)
  disconnect() {
    // 1. Tắt hiển thị Client ngay lập tức
    this.isStreaming.set(false);

    // 2. Dọn dẹp bộ nhớ hiển thị
    this.imageBase64.set('');
    this.metadata.set([]);

    // 3. Gọi API báo Server (Soft Disconnect)
    // Server sẽ log lại là user ngừng xem, NHƯNG KHÔNG TẮT AI
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe({
        next: () => console.log(`Cam ${this.cameraId}: View stopped (AI still running)`),
        error: (err) => console.error(`Cam ${this.cameraId} disconnect failed`, err)
    });

    // LƯU Ý QUAN TRỌNG: Không reset currentOrder/isRecording
    // vì đơn hàng vẫn đang chạy ngầm, thẻ vẫn cần hiện thông tin!
  }

  changeMode(event: Event) {
    const mode = (event.target as HTMLSelectElement).value;
    // API đổi thuật toán AI thì vẫn gọi về server bình thường
    this.streamService.changeMode(this.cameraId, mode);
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    if (this.imgWidth !== img.naturalWidth || this.imgHeight !== img.naturalHeight) {
        this.imgWidth = img.naturalWidth;
        this.imgHeight = img.naturalHeight;
    }
  }

  toggleFullscreen() {
    const elem = this.viewportRef.nativeElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch((err: any) => console.error('Fullscreen Error:', err));
    } else {
      document.exitFullscreen();
    }
  }
}

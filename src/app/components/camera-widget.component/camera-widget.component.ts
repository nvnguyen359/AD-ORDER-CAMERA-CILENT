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
    // Khi F5 xong, dòng này chạy -> Server bắn 'ORDER_CREATED' (Sync) về -> handleMessage hứng -> Hiện lại thông tin
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg: StreamMessage) => this.handleMessage(msg),
      error: (err) => console.error(`Cam ${this.cameraId} socket error:`, err)
    });

    // 2. Mặc định vào là bật xem luôn
    this.connect();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // --- XỬ LÝ SOCKET ---

  private handleMessage(msg: StreamMessage) {
    // 1. Nếu là Ảnh
    if (msg.image) {
        if (this.isStreaming()) {
            this.imageBase64.set(`data:image/jpeg;base64,${msg.image}`);
            this.metadata.set(msg.metadata || []);
        }
        return;
    }

    // 2. Nếu là Sự kiện (Event)
    if (msg.event) {
        console.log(`%c🔥 SOCKET EVENT: ${msg.event}`, 'background: #222; color: #bada55', msg.data);

        // ✅ ĐÂY LÀ CHỖ XỬ LÝ F5 SYNC:
        // Server gửi 'ORDER_CREATED' kèm data cũ -> Code này chạy -> UI cập nhật lại như chưa từng mất kết nối
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
        console.warn('Gói tin không xác định:', msg);
    }
  }

  // --- USER ACTIONS ---

  // Nút "XEM LIVE" (Play)
  connect() {
    this.isStreaming.set(true);
    // Soft Connect: Server biết user đang xem
    this.streamService.toggleCamera(this.cameraId, 'connect').subscribe({
        error: (err) => console.error(`Cam ${this.cameraId} connect failed`, err)
    });
  }

  // Nút "TẮT LIVE" (Stop)
  disconnect() {
    this.isStreaming.set(false);
    this.imageBase64.set('');
    this.metadata.set([]);

    // Soft Disconnect: Server biết user ngừng xem, nhưng AI vẫn chạy ngầm
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe({
        next: () => console.log(`Cam ${this.cameraId}: View stopped (AI still running)`),
        error: (err) => console.error(`Cam ${this.cameraId} disconnect failed`, err)
    });
  }

  changeMode(event: Event) {
    const mode = (event.target as HTMLSelectElement).value;
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

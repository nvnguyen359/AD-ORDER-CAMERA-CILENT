import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  inject,
  ViewChild,
  ElementRef,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
import { OrderInfo } from '../../core/models/monitor-camera.model';
import { MessageService } from 'primeng/api';
@Component({
  selector: 'app-camera-widget',
  standalone: true,
  imports: [CommonModule, VisualizerDirective],
  templateUrl: './camera-widget.component.html',
  styleUrls: ['./camera-widget.component.scss'],
  // [FIX] Bật OnPush để tối ưu render và tránh lỗi check cycle
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) cameraId!: number;
  @Input() cameraName: string = 'Camera';

  private streamService = inject(StreamService);
  private messageService = inject(MessageService);
  private sub: Subscription | null = null;
  private timerSub: Subscription | null = null;

  // --- STATES ---
  isStreaming = signal<boolean>(false);
  isRecording = signal<boolean>(false);
  currentOrder = signal<any | null>(null);

  // Data Stream
  imageBase64 = signal<string>('');
  metadata = signal<any[]>([]); // Dữ liệu AI vẽ khung

  // Kích thước ảnh (Chuyển sang Signal)
  imgWidth = signal<number>(1280);
  imgHeight = signal<number>(720);

  // UX States
  isFullscreen = signal<boolean>(false);
  showOnlineInfo = signal<boolean>(true);
  elapsedMinutes = signal<number>(0);
  currentMode = signal<string>('normal');
  @ViewChild('viewport') viewportRef!: ElementRef;

  // Cắt chuỗi Note
  displayNote = computed(() => {
    const order = this.currentOrder();
    if (!order || !order.note) return '';
    return order.note.split('{')[0].trim();
  });

  private onFullscreenChange = () => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  ngOnInit(): void {
    // 1. Socket
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg: StreamMessage) => this.handleMessage(msg),
      error: (err) => console.error(`Cam ${this.cameraId} socket error:`, err),
    });

    // 2. Timer
    this.timerSub = interval(5000).subscribe(() => this.updateElapsedTime());

    // 3. Fullscreen Listener
    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    this.connect();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timerSub?.unsubscribe();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }
  toggleRecording() {
    if (this.isRecording()) {
      // Đang quay -> Gọi API Dừng
      this.streamService.stopRecording(this.cameraId).subscribe({
        next: (res: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Đã dừng quay',
            detail: res.message,
          });
          // State isRecording sẽ tự động cập nhật về false khi nhận được socket event ORDER_STOPPED
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err.error?.detail || 'Không thể dừng quay',
          });
        },
      });
    } else {
      // Chưa quay -> Gọi API Bắt đầu
      this.streamService.startRecording(this.cameraId).subscribe({
        next: (res: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Bắt đầu quay',
            detail: res.message,
          });
          // State isRecording sẽ tự động cập nhật về true khi nhận được socket event ORDER_CREATED
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err.error?.detail || 'Không thể bắt đầu quay',
          });
        },
      });
    }
  }
  private handleMessage(msg: StreamMessage) {
    // Xử lý Ảnh & Metadata
    if (msg.image) {
      if (this.isStreaming()) {
        this.imageBase64.set(`data:image/jpeg;base64,${msg.image}`);

        // Cập nhật metadata (Quan trọng)
        const meta = msg.metadata && Array.isArray(msg.metadata) ? msg.metadata : [];
        this.metadata.set(meta);
      }
      return;
    }

    // Xử lý Sự kiện
    if (msg.event) {
      if (msg.event === 'ORDER_CREATED') {
        this.isRecording.set(true);
        if (msg.data) {
          this.currentOrder.set(msg.data);
          this.updateElapsedTime();
          this.showOnlineInfo.set(true);
        }
      } else if (msg.event === 'ORDER_STOPPED') {
        this.isRecording.set(false);
        this.currentOrder.set(null);
        this.elapsedMinutes.set(0);
      }
    }
  }

  private updateElapsedTime() {
    const order = this.currentOrder();
    if (order) {
      // Check các trường thời gian có thể có
      const timeStr = order.start_at || order.start_time || order.startTime;
      if (timeStr) {
        const start = new Date(timeStr).getTime();
        const now = Date.now();
        const diffMins = Math.max(0, Math.floor((now - start) / 60000));
        this.elapsedMinutes.set(diffMins);
      }
    } else {
      this.elapsedMinutes.set(0);
    }
  }

  toggleStream() {
    if (this.isStreaming()) this.disconnect();
    else this.connect();
  }

  connect() {
    this.isStreaming.set(true);
    this.streamService.toggleCamera(this.cameraId, 'connect').subscribe();
  }

  disconnect() {
    this.isStreaming.set(false);
    this.imageBase64.set('');
    this.metadata.set([]);
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe();
  }

  changeMode(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      // 1. Cập nhật UI Frontend ngay lập tức
      this.currentMode.set(target.value);

      // 2. Gửi lệnh xuống Backend (để xử lý logic server nếu cần)
      this.streamService.changeMode(this.cameraId, target.value);
    }
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    // Kiểm tra xem kích thước có thực sự thay đổi không
    if (this.imgWidth() !== img.naturalWidth || this.imgHeight() !== img.naturalHeight) {
      // [FIX] Bọc trong setTimeout để đẩy việc cập nhật sang tick tiếp theo
      // Khắc phục lỗi NG0100: ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.imgWidth.set(img.naturalWidth);
        this.imgHeight.set(img.naturalHeight);
      }, 0);
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

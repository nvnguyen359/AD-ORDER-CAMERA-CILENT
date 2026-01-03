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
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError, filter } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

// --- IMPORTS SERVICES ---
import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { CameraService } from '../../core/services/camera.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
import { environment } from '../../environments/environment';
import { SharedService } from '../../core/services/sharedService';
import { StorageService } from '../../core/services/storage.service';

type ViewMode = 'NONE' | 'ALL' | 'HUMAN' | 'QRCODE';
type RecordingState = 'IDLE' | 'MANUAL' | 'AUTO' | 'BUFFERING'; // Thêm BUFFERING nếu cần

@Component({
  selector: 'app-camera-widget',
  standalone: true,
  imports: [
    CommonModule,
    VisualizerDirective,
    FormsModule,
    SelectModule,
    TooltipModule,
    ToastModule,
  ],
  templateUrl: './camera-widget.component.html',
  styleUrls: ['./camera-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
})
export class CameraWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) cameraId!: number;
  @Input() cameraName: string = 'Camera';

  private streamService = inject(StreamService);
  private cameraService = inject(CameraService);
  private messageService = inject(MessageService);
  private storageService = inject(StorageService);

  private sub: Subscription | null = null;
  private pollSub: Subscription | null = null;

  // Timers
  private hideControlsTimer: any;
  private scanResetTimer: any;
  private orderInfoResetTimer: any;
  private uiLoopInterval: any;

  // --- STATES ---
  isStreaming = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);
  isBuffering = signal<boolean>(false); // Trạng thái đang nhận diện mã (màu vàng)

  // Trạng thái ghi hình
  recordingState = signal<RecordingState>('IDLE');

  // Thông tin hiển thị
  orderCode = signal<string | null>(null);
  scannedCode = signal<string | null>(null);
  qrCode = '';

  showControls = signal<boolean>(true);
  viewMode = signal<ViewMode>('NONE');
  rawOverlayData = signal<any[]>([]);

  imgWidth = signal<number>(1280);
  imgHeight = signal<number>(720);

  // --- VISUAL CUES (TIMEOUT) ---
  timeoutPercent = signal<number>(0);
  timeRemaining = signal<number>(0);
  // Cảnh báo khi thời gian còn dưới 30%
  isTimeoutWarning = computed(() => {
    return this.timeoutPercent() > 0 && this.timeoutPercent() < 30;
  });

  private lastHumanTime: number = Date.now();
  private readonly TIMEOUT_LIMIT_SEC = 60; // Timeout 60s (Cần khớp với Backend)

  @ViewChild('viewport') viewportRef!: ElementRef;

  // --- COMPUTED VALUES ---
  isRecording = computed(() => this.recordingState() !== 'IDLE');

  streamUrl = computed(() => {
    return this.isStreaming()
      ? `${environment.apiUrl}/cameras/${this.cameraId}/stream?t=${Date.now()}`
      : '';
  });

  visibleOverlayData = computed(() => {
    const mode = this.viewMode();
    if (mode === 'NONE') return [];
    const data = this.rawOverlayData();
    if (mode === 'ALL') return data;
    return data.filter((item) => {
      const isHuman = item.label === 'Person' || item.color === '#e74c3c';
      if (mode === 'HUMAN') return isHuman;
      if (mode === 'QRCODE') return !isHuman;
      return true;
    });
  });

  // Icon nút ghi hình thay đổi theo trạng thái
  recordBtnIcon = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'pi pi-stop-circle';
      case 'AUTO': return 'pi pi-lock';
      default: return 'pi pi-video';
    }
  });

  // Màu nút ghi hình
  recordBtnClass = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'p-button-danger';
      case 'AUTO': return 'p-button-warning';
      default: return 'p-button-secondary';
    }
  });

  recordBtnTooltip = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'Dừng ghi hình thủ công & Lưu';
      case 'AUTO': return 'Hệ thống đang quay tự động (Không thể can thiệp)';
      default: return 'Bắt đầu ghi hình thủ công';
    }
  });

  viewOptions = [
    { label: 'Không hiển thị', value: 'NONE', icon: 'pi pi-eye-slash' },
    { label: 'Tất cả', value: 'ALL', icon: 'pi pi-eye' },
    { label: 'Người', value: 'HUMAN', icon: 'pi pi-user' },
    { label: 'QR Code', value: 'QRCODE', icon: 'pi pi-qrcode' },
  ];

  constructor() {
    // Tự động bật/tắt polling AI Overlay khi stream thay đổi
    effect(() => {
      if (this.isStreaming() && this.viewMode() !== 'NONE') {
        this.startOverlayPolling();
      } else {
        this.stopOverlayPolling();
        this.rawOverlayData.set([]);
      }
    });
  }

  ngOnInit(): void {
    // Khôi phục mã QR tạm (nếu có)
    this.qrCode = this.storageService.getItem('code') ? `${this.storageService.getItem('code')}` : '';

    // 1. WebSocket Listener
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg) => this.handleMessage(msg),
      error: (err) => console.error(err),
    });

    // 2. Lấy trạng thái ban đầu (Fix lỗi F5)
    this.fetchInitialState();

    // 3. Sự kiện Fullscreen
    document.addEventListener('fullscreenchange', () =>
      this.isFullscreen.set(!!document.fullscreenElement)
    );

    this.resetControlTimer();

    // 4. Bắt đầu vòng lặp UI (cho Timeout Bar)
    this.startUiLoop();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.stopOverlayPolling();

    clearTimeout(this.hideControlsTimer);
    clearTimeout(this.scanResetTimer);
    clearTimeout(this.orderInfoResetTimer);
    clearInterval(this.uiLoopInterval);

    if (this.isStreaming()) this.disconnect();
  }

  // --- API CALLS ---

  private fetchInitialState() {
    this.cameraService.getCamera(this.cameraId).subscribe({
      next: (res: any) => {
        const camData = res.data || res;
        if (camData && camData.recording_state) {
          this.recordingState.set(camData.recording_state);

          if (camData.is_connected) {
            this.isStreaming.set(true);
          }

          if (camData.recording_state === 'AUTO') {
            this.orderCode.set(camData.active_order_code || 'Auto Recording');
            this.onHumanDetected(); // Reset timeout khi mới vào
          } else if (camData.recording_state === 'MANUAL') {
            this.orderCode.set('Thủ công');
          }
        }
      },
      error: (err) => console.error('Error fetching camera state:', err),
    });
  }

  // --- ACTIONS ---

  toggleConnect() {
    const nextState = !this.isStreaming();
    if (nextState) this.isLoading.set(true);

    const action = nextState ? 'connect' : 'disconnect';
    this.streamService.toggleCamera(this.cameraId, action).subscribe({
      next: () => {
        this.isStreaming.set(nextState);
        if (!nextState) this.isLoading.set(false);
        this.resetControlTimer();
      },
      error: () => {
        this.isLoading.set(false);
        this.isStreaming.set(false);
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể kết nối' });
      },
    });
  }

  toggleRecording(event?: Event) {
    event?.stopPropagation();
    const currentState = this.recordingState();

    // 1. AUTO: Chặn can thiệp
    if (currentState === 'AUTO') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Hệ thống đang bận',
        detail: 'Camera đang thực hiện đơn hàng tự động.',
      });
      return;
    }

    // 2. MANUAL -> STOP
    if (currentState === 'MANUAL') {
      const payload = {
        order_code: `DH-${Date.now()}`,
        client_id: 1,
        note: 'Dừng quay thủ công từ Widget',
      };

      this.orderCode.set('Đang lưu...');

      this.streamService.stopRecording(this.cameraId, payload).subscribe({
        next: (res: any) => {
          this.recordingState.set('IDLE');
          this.orderCode.set('Đã hoàn thành');
          this.timeoutPercent.set(0); // Reset timeout bar

          clearTimeout(this.orderInfoResetTimer);
          this.orderInfoResetTimer = setTimeout(() => this.orderCode.set(null), 3000);

          this.messageService.add({ severity: 'success', summary: 'Đã lưu video', detail: 'Đơn hàng đã được tạo thành công.' });
        },
        error: (err) => {
          console.error(err);
          this.orderCode.set('Lỗi lưu');
          this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể dừng quay.' });
        },
      });
    }
    // 3. IDLE -> START (MANUAL)
    else {
      this.streamService.startRecording(this.cameraId).subscribe({
        next: (res: any) => {
          this.recordingState.set('MANUAL');
          this.orderCode.set('Quay Thủ Công');
          this.timeoutPercent.set(0); // Manual không có timeout

          this.messageService.add({ severity: 'success', summary: 'Bắt đầu ghi hình', detail: 'Đang ghi hình thủ công.' });
        },
        error: (err) => {
          console.error(err);
          this.messageService.add({ severity: 'error', summary: 'Không thể ghi hình', detail: 'Camera đang bận hoặc gặp lỗi kết nối.' });
        },
      });
    }
  }

  // --- INTERNAL LOGIC ---

  private handleMessage(msg: StreamMessage) {
    if (msg.event === 'ORDER_CREATED') {
      this.storageService.setItem('code', msg['data']['code']);
      this.recordingState.set('AUTO');

      const code = (msg.data && msg.data.order_code) ? msg.data.order_code : msg.data.code;
      this.orderCode.set(code || 'Auto Order');

      this.onHumanDetected(); // Reset timeout khi bắt đầu đơn

    } else if (msg.event === 'ORDER_STOPPED') {
      this.recordingState.set('IDLE');
      this.orderCode.set('Đã hoàn thành');
      this.storageService.removeItem('code');
      this.timeoutPercent.set(0);

      clearTimeout(this.orderInfoResetTimer);
      this.orderInfoResetTimer = setTimeout(() => this.orderCode.set(null), 3000);

    } else if (msg.event === 'QR_SCANNED' || msg.event === 'BARCODE_DETECTED') {
      const codeValue = msg.data?.code || msg.data;
      const displayValue = typeof codeValue === 'object' ? JSON.stringify(codeValue) : String(codeValue);

      this.scannedCode.set(displayValue);
      clearTimeout(this.scanResetTimer);
      this.scanResetTimer = setTimeout(() => this.scannedCode.set(null), 5000);

      // Nếu đang IDLE mà quét được mã -> Có thể đang Buffering
      if (this.recordingState() === 'IDLE') {
          this.isBuffering.set(true);
          // Tắt buffering sau 3s nếu không có đơn
          setTimeout(() => this.isBuffering.set(false), 3000);
      }
    }
  }

  // --- POLLING AI OVERLAY & HUMAN DETECTION ---

  private startOverlayPolling() {
    if (this.pollSub) return;
    this.pollSub = interval(100)
      .pipe(
        filter(() => this.isStreaming()),
        switchMap(() => this.cameraService.getAIOverlay(this.cameraId).pipe(catchError(() => of([]))))
      )
      .subscribe((data) => {
        this.rawOverlayData.set(data);

        // [LOGIC MỚI] Kiểm tra có người không để reset timeout
        const hasHuman = data.some(item => item.label === 'Person' || item.color === '#e74c3c');
        if (hasHuman) {
            this.onHumanDetected();
        }
      });
  }

  private stopOverlayPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  // --- TIMEOUT UI LOGIC ---

  private startUiLoop() {
    this.uiLoopInterval = setInterval(() => {
        // Chỉ chạy khi đang AUTO (Manual không timeout)
        if (this.recordingState() === 'AUTO') {
            const now = Date.now();
            const elapsedSec = (now - this.lastHumanTime) / 1000;
            const remaining = Math.max(0, this.TIMEOUT_LIMIT_SEC - elapsedSec);

            this.timeRemaining.set(Math.floor(remaining));

            if (remaining <= 0) {
                this.timeoutPercent.set(0);
            } else {
                // Tính %: 100% là đầy thời gian, 0% là hết giờ
                const pct = (remaining / this.TIMEOUT_LIMIT_SEC) * 100;
                this.timeoutPercent.set(pct);
            }
        } else {
            this.timeoutPercent.set(0);
        }
    }, 200); // 5fps
  }

  // Gọi hàm này khi thấy người để reset đồng hồ
  private onHumanDetected() {
    this.lastHumanTime = Date.now();
    this.timeoutPercent.set(100);
  }

  // --- UI HELPERS ---

  onUserInteraction() {
    this.showControls.set(true);
    this.resetControlTimer();
  }

  onMouseLeave() {
    if (this.isStreaming()) this.showControls.set(false);
  }

  resetControlTimer() {
    clearTimeout(this.hideControlsTimer);
    this.hideControlsTimer = setTimeout(() => {
      if (this.isStreaming()) this.showControls.set(false);
    }, 2000);
  }

  onViewportClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('p-select, button, .p-select-overlay, .p-select-item')) return;
    this.toggleConnect();
    this.onUserInteraction();
  }

  toggleFullscreen(event?: Event) {
    event?.stopPropagation();
    const elem = this.viewportRef.nativeElement;
    !document.fullscreenElement ? elem.requestFullscreen() : document.exitFullscreen();
  }

  disconnect() {
    this.isStreaming.set(false);
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe();
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth > 0) {
      if (this.imgWidth() !== img.naturalWidth) {
        this.imgWidth.set(img.naturalWidth);
        this.imgHeight.set(img.naturalHeight);
      }
      this.isLoading.set(false);
    }
  }

  onImageError(event: Event) {}
}

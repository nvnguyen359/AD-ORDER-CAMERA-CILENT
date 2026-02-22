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
import { Subscription } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { CameraService } from '../../core/services/camera.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
import { environment } from '../../environments/environment';
import { SharedService } from '../../core/services/sharedService';
import { StorageService } from '../../core/services/storage.service';
import { SettingsService } from '../../core/services/settings.service';

type ViewMode = 'NONE' | 'ALL' | 'HUMAN' | 'QRCODE';
type RecordingState = 'IDLE' | 'MANUAL' | 'AUTO';

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
  // [MỚI] Input để bật tự động kết nối khi chuyển Tab
  @Input() autoConnect: boolean = false;

  private streamService = inject(StreamService);
  private cameraService = inject(CameraService);
  private messageService = inject(MessageService);
  private storageService = inject(StorageService);
  private settingsService = inject(SettingsService);

  private sub: Subscription | null = null;
  private uiLoopInterval: any;
  private hideControlsTimer: any;
  private scanResetTimer: any;
  private orderInfoResetTimer: any;

  // --- STATE SIGNALS ---
  isStreaming = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);
  isBuffering = signal<boolean>(false);

  // Trạng thái quay: IDLE (Nghỉ), AUTO (Đóng hàng), MANUAL (Quay tay)
  recordingState = signal<RecordingState>('IDLE');

  // Mã đơn hàng (nếu đang quay)
  orderCode = signal<string | null>(null);
  scannedCode = signal<string | null>(null);
  qrCode = '';

  showControls = signal<boolean>(true);
  viewMode = signal<ViewMode>('ALL');

  rawOverlayData = signal<any[]>([]);

  // Độ phân giải (Mặc định HD, sẽ update từ stream thực tế)
  imgWidth = signal<number>(1280);
  imgHeight = signal<number>(720);

  // Tính tỉ lệ khung hình cho CSS (16/9, 4/3...)
  aspectRatio = computed(() => `${this.imgWidth()} / ${this.imgHeight()}`);

  // Logic Timeout (Cảnh báo nếu nhân viên đi vắng quá lâu)
  timeoutPercent = signal<number>(0);
  timeRemaining = signal<number>(0);
  isTimeoutWarning = computed(() => this.timeoutPercent() > 0 && this.timeoutPercent() < 30);
  private lastHumanTime: number = Date.now();
  private readonly TIMEOUT_LIMIT_SEC = 60;

  @ViewChild('viewport') viewportRef!: ElementRef;

  // Biến Computed hỗ trợ HTML
  isRecording = computed(() => this.recordingState() !== 'IDLE');
  // Thêm timestamp để ép trình duyệt load lại ảnh mới khi reconnect
  streamUrl = computed(() => this.isStreaming() ? `${environment.apiUrl}/cameras/${this.cameraId}/stream?t=${Date.now()}` : '');

  // Lọc dữ liệu vẽ khung (Human/QR)
  visibleOverlayData = computed(() => {
    const mode = this.viewMode();
    if (mode === 'NONE') return [];
    const data = this.rawOverlayData();
    if (mode === 'ALL') return data;
    return data.filter((item) => {
      const label = item.label || '';
      const color = item.color || '';
      const isHuman = label.includes('Person') || label.includes('Human') || color === '#e74c3c';
      if (mode === 'HUMAN') return isHuman;
      if (mode === 'QRCODE') return !isHuman;
      return true;
    });
  });

  // [FIX] Cập nhật Icon: AUTO cũng hiện nút Stop
  recordBtnIcon = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'pi pi-stop-circle';
      case 'AUTO': return 'pi pi-stop-circle'; // Cho phép Stop khi đang Auto
      default: return 'pi pi-video';
    }
  });

  // [FIX] Cập nhật Tooltip
  recordBtnTooltip = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'Dừng & Lưu';
      case 'AUTO': return 'Bắt buộc dừng (Force Stop)';
      default: return 'Ghi hình thủ công';
    }
  });

  viewOptions = [
    { label: 'Không hiển thị', value: 'NONE', icon: 'pi pi-eye-slash' },
    { label: 'Tất cả', value: 'ALL', icon: 'pi pi-eye' },
    { label: 'Người', value: 'HUMAN', icon: 'pi pi-user' },
    { label: 'QR Code', value: 'QRCODE', icon: 'pi pi-qrcode' },
  ];

  constructor() {
    effect(() => {
      if (!this.isStreaming() || this.viewMode() === 'NONE') {
        this.rawOverlayData.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.qrCode = this.storageService.getItem('code') ? `${this.storageService.getItem('code')}` : '';

    // 1. Lấy độ phân giải từ Settings làm mặc định ban đầu (Dự phòng trước khi stream lên)
    this.settingsService.getSettings().subscribe({
        next: (data: any) => {
            const w = Number(data['camera_width']);
            const h = Number(data['camera_height']);
            if (w && h) {
                this.imgWidth.set(w);
                this.imgHeight.set(h);
            }
        },
        error: (err) => console.warn('Load settings failed, using default 1280x720')
    });

    // 2. Kết nối Socket & Lắng nghe sự kiện
    this.streamService.connectSocket();
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg) => this.handleMessage(msg),
      error: (err) => console.error('Stream Sub Error:', err),
    });

    // 3. Kiểm tra trạng thái hiện tại (Đề phòng F5 trang lúc đang quay)
    this.fetchInitialState();

    document.addEventListener('fullscreenchange', () => this.isFullscreen.set(!!document.fullscreenElement));
    this.resetControlTimer();
    this.startUiLoop();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.hideControlsTimer);
    clearTimeout(this.scanResetTimer);
    clearTimeout(this.orderInfoResetTimer);
    clearInterval(this.uiLoopInterval);
    if (this.isStreaming()) this.disconnect();
  }

  // =====================================================================
  // XỬ LÝ SOCKET
  // =====================================================================
  private handleMessage(msg: StreamMessage) {
    const rawMsg = msg as any;
    if (rawMsg.cam_id !== undefined && rawMsg.cam_id != this.cameraId) return;
    if (msg.data && (msg.data as any).cam_id !== undefined && (msg.data as any).cam_id != this.cameraId) return;

    if (msg.metadata) {
        this.rawOverlayData.set(msg.metadata);
    }

    if (msg.event === 'QR_SCANNED' || msg.event === 'BARCODE_DETECTED') {
        const codeValue = msg.data?.code || msg.data;
        const displayValue = typeof codeValue === 'object' ? JSON.stringify(codeValue) : String(codeValue);

        this.scannedCode.set(displayValue);
        this.isBuffering.set(true);
        setTimeout(() => this.isBuffering.set(false), 1500);

        clearTimeout(this.scanResetTimer);
        this.scanResetTimer = setTimeout(() => this.scannedCode.set(null), 5000);
    }
    else if (msg.event === 'ORDER_CREATED') {
      console.log(`[Cam ${this.cameraId}] 🟢 Order Started:`, msg.data);
      const code = (msg.data && msg.data.order_code) ? msg.data.order_code : msg.data.code;
      this.storageService.setItem('code', code);
      this.recordingState.set('AUTO');
      this.orderCode.set(code || 'Auto Order');
      this.onHumanDetected();
    }
    else if (msg.event === 'ORDER_STOPPED') {
      console.log(`[Cam ${this.cameraId}] 🔴 Order Stopped`);
      this.recordingState.set('IDLE');
      this.orderCode.set('Đã hoàn thành');
      this.storageService.removeItem('code');
      this.timeoutPercent.set(0);
      clearTimeout(this.orderInfoResetTimer);
      this.orderInfoResetTimer = setTimeout(() => this.orderCode.set(null), 3000);
    }
  }

  // Lấy trạng thái ban đầu từ API
  private fetchInitialState() {
    this.cameraService.getCamera(this.cameraId).subscribe({
      next: (res: any) => {
        const camData = res.data || res;
        if (camData) {
            // [NÂNG CẤP] Logic Auto Connect
            // Backend mới sẽ trả về 'is_connected' = true nếu Worker đang chạy.
            if (camData.is_connected) {
                this.isStreaming.set(true);
            } else if (this.autoConnect) {
                // Nếu chưa chạy mà có cờ autoConnect -> Gọi API bật ngay
                console.log(`[Cam ${this.cameraId}] 🔌 Auto Connecting...`);
                this.toggleConnect();
            }

            if (camData.recording_state) {
                this.recordingState.set(camData.recording_state);
            }

            if (camData.recording_state === 'AUTO') {
                this.orderCode.set(camData.active_order_code || 'Đang đóng gói');
                this.onHumanDetected();
            } else if (camData.recording_state === 'MANUAL') {
                this.orderCode.set('Thủ công');
            }
        }
      },
      error: (err) => console.error('Error fetching state:', err),
    });
  }

  // --- ACTIONS ---
  toggleConnect() {
    // Nếu đang stream -> Tắt đi (false)
    // Nếu đang tắt -> Bật lên (true)
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
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Lỗi kết nối Camera' });
      },
    });
  }

  toggleRecording(event?: Event) {
    event?.stopPropagation();
    const currentState = this.recordingState();

    // Nếu đang quay (bao gồm cả MANUAL và AUTO) -> Thực hiện STOP
    if (currentState === 'MANUAL' || currentState === 'AUTO') {
      this.orderCode.set('Đang lưu...');

      this.streamService.stopRecording(this.cameraId).subscribe({
        next: () => {
          this.recordingState.set('IDLE');
          this.orderCode.set('Đã lưu');
          setTimeout(() => this.orderCode.set(null), 3000);
          this.messageService.add({ severity: 'success', summary: 'OK', detail: 'Đã dừng ghi hình.' });
        },
        error: () => {
          this.orderCode.set('Lỗi lưu');
          this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể dừng video.' });
        }
      });
    } else {
      // --- START RECORDING ---
      const manualCode = `MANUAL_${Date.now()}`;

      this.streamService.startRecording(this.cameraId, manualCode).subscribe({
        next: () => {
          this.recordingState.set('MANUAL');
          this.orderCode.set('Thủ Công');
          this.messageService.add({ severity: 'success', summary: 'Start', detail: 'Bắt đầu ghi hình thủ công.' });
        },
        error: () => this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể bắt đầu.' })
      });
    }
  }

  private startUiLoop() {
    this.uiLoopInterval = setInterval(() => {
        if (this.recordingState() === 'AUTO') {
            const remaining = Math.max(0, this.TIMEOUT_LIMIT_SEC - (Date.now() - this.lastHumanTime) / 1000);
            this.timeRemaining.set(Math.floor(remaining));
            this.timeoutPercent.set((remaining / this.TIMEOUT_LIMIT_SEC) * 100);
        } else {
            this.timeoutPercent.set(0);
        }
    }, 200);
  }

  private onHumanDetected() {
    this.lastHumanTime = Date.now();
    this.timeoutPercent.set(100);
  }

  // --- UI EVENTS ---
  onUserInteraction() {
    this.showControls.set(true);
    this.resetControlTimer();
  }
  onMouseLeave() { if (this.isStreaming()) this.showControls.set(false); }
  resetControlTimer() {
    clearTimeout(this.hideControlsTimer);
    this.hideControlsTimer = setTimeout(() => { if (this.isStreaming()) this.showControls.set(false); }, 2000);
  }
  onViewportClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('p-select, button')) return;
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

  // =====================================================================
  // [CẬP NHẬT MỚI] XỬ LÝ LUỒNG VIDEO
  // =====================================================================
  onImageLoad(event: Event) {
    this.isLoading.set(false);

    // Tự động nhận diện độ phân giải thực tế của thẻ IMG (stream luồng từ OpenCV về)
    // Giúp Canvas Map tọa độ AI chính xác 100% với khung hình.
    const imgTarget = event.target as HTMLImageElement;
    
    if (imgTarget && imgTarget.naturalWidth && imgTarget.naturalHeight) {
      const currentW = this.imgWidth();
      const currentH = this.imgHeight();
      
      // Chỉ cập nhật tín hiệu và render lại Canvas nếu độ phân giải thật sự thay đổi
      if (currentW !== imgTarget.naturalWidth || currentH !== imgTarget.naturalHeight) {
        console.log(`[Cam ${this.cameraId}] 📐 Auto-Resizing Canvas to match stream: ${imgTarget.naturalWidth}x${imgTarget.naturalHeight}`);
        
        this.imgWidth.set(imgTarget.naturalWidth);
        this.imgHeight.set(imgTarget.naturalHeight);
      }
    }
  }

  onImageError(event: Event) {
      if (this.isStreaming()) {
          console.warn(`[Cam ${this.cameraId}] Stream Error (Broken Pipe). Backend reconnecting...`);
      }
  }
}
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

  private streamService = inject(StreamService);
  private cameraService = inject(CameraService);
  private messageService = inject(MessageService);
  private storageService = inject(StorageService);

  private sub: Subscription | null = null;
  private uiLoopInterval: any;
  private hideControlsTimer: any;
  private scanResetTimer: any;
  private orderInfoResetTimer: any;

  isStreaming = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);
  isBuffering = signal<boolean>(false);

  recordingState = signal<RecordingState>('IDLE');
  orderCode = signal<string | null>(null);
  scannedCode = signal<string | null>(null);
  qrCode = '';

  showControls = signal<boolean>(true);
  viewMode = signal<ViewMode>('ALL');

  rawOverlayData = signal<any[]>([]);

  imgWidth = signal<number>(1280);
  imgHeight = signal<number>(720);

  // Layout tính toán động (quan trọng để fix layout)
  aspectRatio = computed(() => `${this.imgWidth()} / ${this.imgHeight()}`);

  timeoutPercent = signal<number>(0);
  timeRemaining = signal<number>(0);
  isTimeoutWarning = computed(() => this.timeoutPercent() > 0 && this.timeoutPercent() < 30);
  private lastHumanTime: number = Date.now();
  private readonly TIMEOUT_LIMIT_SEC = 60;

  @ViewChild('viewport') viewportRef!: ElementRef;

  isRecording = computed(() => this.recordingState() !== 'IDLE');
  // Thêm timestamp để ép ảnh reload, tránh cache
  streamUrl = computed(() => this.isStreaming() ? `${environment.apiUrl}/cameras/${this.cameraId}/stream?t=${Date.now()}` : '');

  visibleOverlayData = computed(() => {
    const mode = this.viewMode();
    if (mode === 'NONE') return [];

    const data = this.rawOverlayData();
    if (mode === 'ALL') return data;

    return data.filter((item) => {
      // Logic lọc Human/QR
      const label = item.label || '';
      const color = item.color || '';
      const isHuman = label.includes('Person') || label.includes('Human') || color === '#e74c3c';

      if (mode === 'HUMAN') return isHuman;
      if (mode === 'QRCODE') return !isHuman;
      return true;
    });
  });

  recordBtnIcon = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'pi pi-stop-circle';
      case 'AUTO': return 'pi pi-lock';
      default: return 'pi pi-video';
    }
  });

  recordBtnClass = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'p-button-danger';
      case 'AUTO': return 'p-button-warning';
      default: return 'p-button-secondary';
    }
  });

  recordBtnTooltip = computed(() => {
    switch (this.recordingState()) {
      case 'MANUAL': return 'Dừng & Lưu';
      case 'AUTO': return 'Đang quay tự động';
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
    this.streamService.connectSocket();

    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg) => this.handleMessage(msg),
      error: (err) => console.error('Stream Sub Error:', err),
    });

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

  private handleMessage(msg: StreamMessage) {
    // =========================================================================
    // [FIX LỖI TS & GHOSTING]
    // =========================================================================
    // 1. Ép kiểu 'any' để bypass lỗi TypeScript "Property cam_id does not exist"
    const rawMsg = msg as any;

    // 2. Chặn dữ liệu của Camera khác tràn vào
    if (rawMsg.cam_id !== undefined && rawMsg.cam_id != this.cameraId) {
        return;
    }
    // Check thêm nếu cam_id nằm lồng trong data (tuỳ BE trả về)
    if (msg.data && (msg.data as any).cam_id !== undefined && (msg.data as any).cam_id != this.cameraId) {
        return;
    }
    // =========================================================================

    if (msg.metadata) {
        this.rawOverlayData.set(msg.metadata);
    }

    if (msg.event === 'QR_SCANNED' || msg.event === 'BARCODE_DETECTED') {
        const codeValue = msg.data?.code || msg.data;
        const displayValue = typeof codeValue === 'object' ? JSON.stringify(codeValue) : String(codeValue);
        this.scannedCode.set(displayValue);
        this.isBuffering.set(true);
        setTimeout(() => this.isBuffering.set(false), 2000);
        clearTimeout(this.scanResetTimer);
        this.scanResetTimer = setTimeout(() => this.scannedCode.set(null), 5000);
    }
    else if (msg.event === 'ORDER_CREATED') {
      this.storageService.setItem('code', msg['data']['code']);
      this.recordingState.set('AUTO');
      const code = (msg.data && msg.data.order_code) ? msg.data.order_code : msg.data.code;
      this.orderCode.set(code || 'Auto Order');
      this.onHumanDetected();
    }
    else if (msg.event === 'ORDER_STOPPED') {
      this.recordingState.set('IDLE');
      this.orderCode.set('Đã hoàn thành');
      this.storageService.removeItem('code');
      this.timeoutPercent.set(0);
      clearTimeout(this.orderInfoResetTimer);
      this.orderInfoResetTimer = setTimeout(() => this.orderCode.set(null), 3000);
    }
  }

  private fetchInitialState() {
    this.cameraService.getCamera(this.cameraId).subscribe({
      next: (res: any) => {
        const camData = res.data || res;
        if (camData) {
            if (camData.is_connected) this.isStreaming.set(true);
            if (camData.recording_state) this.recordingState.set(camData.recording_state);
            if (camData.recording_state === 'AUTO') {
                this.orderCode.set(camData.active_order_code || 'Auto Recording');
                this.onHumanDetected();
            } else if (camData.recording_state === 'MANUAL') {
                this.orderCode.set('Thủ công');
            }
        }
      },
      error: (err) => console.error('Error fetching state:', err),
    });
  }

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
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Lỗi kết nối' });
      },
    });
  }

  toggleRecording(event?: Event) {
    event?.stopPropagation();
    const currentState = this.recordingState();
    if (currentState === 'AUTO') return;

    if (currentState === 'MANUAL') {
      const payload = { order_code: `DH-${Date.now()}`, client_id: 1, note: 'Manual Stop' };
      this.orderCode.set('Đang lưu...');
      this.streamService.stopRecording(this.cameraId, payload).subscribe({
        next: () => {
          this.recordingState.set('IDLE');
          this.orderCode.set('Hoàn thành');
          this.timeoutPercent.set(0);
          clearTimeout(this.orderInfoResetTimer);
          this.orderInfoResetTimer = setTimeout(() => this.orderCode.set(null), 3000);
          this.messageService.add({ severity: 'success', summary: 'OK', detail: 'Đã lưu video.' });
        },
        error: () => this.orderCode.set('Lỗi lưu')
      });
    } else {
      this.streamService.startRecording(this.cameraId).subscribe({
        next: () => {
          this.recordingState.set('MANUAL');
          this.orderCode.set('Thủ Công');
          this.messageService.add({ severity: 'success', summary: 'Start', detail: 'Bắt đầu ghi hình.' });
        },
        error: () => this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Lỗi bắt đầu.' })
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

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth > 0) {
        this.imgWidth.set(img.naturalWidth);
        this.imgHeight.set(img.naturalHeight);
        this.isLoading.set(false);
    }
  }
  onImageError(event: Event) { }
}

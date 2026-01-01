import {
  Component, Input, OnInit, OnDestroy, signal, inject, ViewChild,
  ElementRef, computed, ChangeDetectionStrategy, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select'; // PrimeNG v21 Select
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError, filter } from 'rxjs/operators';
import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { CameraService } from '../../core/services/camera.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
import { MessageService } from 'primeng/api';
import { environment } from '../../environments/environment';

type ViewMode = 'NONE' | 'ALL' | 'HUMAN' | 'QRCODE';

@Component({
  selector: 'app-camera-widget',
  standalone: true,
  imports: [CommonModule, VisualizerDirective, FormsModule, SelectModule],
  templateUrl: './camera-widget.component.html',
  styleUrls: ['./camera-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) cameraId!: number;
  @Input() cameraName: string = 'Camera';

  private streamService = inject(StreamService);
  private cameraService = inject(CameraService);
  private messageService = inject(MessageService);

  private sub: Subscription | null = null;
  private pollSub: Subscription | null = null;
  private timerSub: Subscription | null = null;

  // --- STATES ---
  isStreaming = signal<boolean>(false);
  isRecording = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);

  // [MỚI] Biến chứa mã vạch/QR vừa quét được
  scannedCode = signal<string | null>(null); // Ví dụ: 'VN-123456'

  showControls = signal<boolean>(true);
  private hideControlsTimer: any;
  private scanResetTimer: any; // Timer để tự ẩn mã sau một thời gian (nếu cần)

  viewMode = signal<ViewMode>('NONE');

  viewOptions = [
    { label: 'Không hiển thị', value: 'NONE',   icon: 'pi pi-eye-slash' },
    { label: 'Tất cả',         value: 'ALL',    icon: 'pi pi-eye' },
    { label: 'Người',          value: 'HUMAN',  icon: 'pi pi-user' },
    { label: 'QR Code',        value: 'QRCODE', icon: 'pi pi-qrcode' }
  ];

  rawOverlayData = signal<any[]>([]);

  visibleOverlayData = computed(() => {
    const mode = this.viewMode();
    if (mode === 'NONE') return [];

    const data = this.rawOverlayData();
    if (mode === 'ALL') return data;

    return data.filter(item => {
      const isHuman = item.label === 'Person' || item.color === '#e74c3c';
      if (mode === 'HUMAN') return isHuman;
      if (mode === 'QRCODE') return !isHuman;
      return true;
    });
  });

  imgWidth = signal<number>(1280);
  imgHeight = signal<number>(720);

  @ViewChild('viewport') viewportRef!: ElementRef;

  streamUrl = computed(() => {
    return this.isStreaming()
      ? `${environment.apiUrl}/cameras/${this.cameraId}/stream?t=${Date.now()}`
      : '';
  });

  constructor() {
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
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg) => this.handleMessage(msg),
      error: (err) => console.error(err),
    });

    document.addEventListener('fullscreenchange', () => this.isFullscreen.set(!!document.fullscreenElement));
    this.resetControlTimer();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.stopOverlayPolling();
    clearTimeout(this.hideControlsTimer);
    clearTimeout(this.scanResetTimer);
    if (this.isStreaming()) this.disconnect();
  }

  // --- INTERACTION ---

  onUserInteraction() {
    this.showControls.set(true);
    this.resetControlTimer();
  }

  onMouseLeave() {
    if (this.isStreaming()) {
        this.showControls.set(false);
    }
  }

  resetControlTimer() {
    clearTimeout(this.hideControlsTimer);
    this.hideControlsTimer = setTimeout(() => {
      if (this.isStreaming()) {
        this.showControls.set(false);
      }
    }, 2000);
  }

  onViewportClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('p-select, button, .p-select-overlay, .p-select-item')) return;
    this.toggleConnect();
    this.onUserInteraction();
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
        this.messageService.add({severity: 'error', summary: 'Lỗi', detail: 'Không thể kết nối'});
      }
    });
  }

  toggleRecording(event?: Event) {
    event?.stopPropagation();
    const action$ = this.isRecording()
      ? this.streamService.stopRecording(this.cameraId)
      : this.streamService.startRecording(this.cameraId);

    action$.subscribe({
      next: (res: any) => this.messageService.add({ severity: 'success', summary: 'Thành công', detail: res.mes }),
      error: () => this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể thực hiện' })
    });
  }

  private startOverlayPolling() {
    if (this.pollSub) return;
    this.pollSub = interval(100).pipe(
      filter(() => this.isStreaming()),
      switchMap(() => this.cameraService.getAIOverlay(this.cameraId).pipe(
        catchError(() => of([]))
      ))
    ).subscribe(data => this.rawOverlayData.set(data));
  }

  private stopOverlayPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  private handleMessage(msg: StreamMessage) {
 const data = this.rawOverlayData();
 console.log(data)
    if (msg.event === 'ORDER_CREATED') {
        this.isRecording.set(true);
    } else if (msg.event === 'ORDER_STOPPED') {
        this.isRecording.set(false);
    }
    // [MỚI] Xử lý sự kiện quét QR (Giả định msg.event là 'QR_SCANNED' hoặc 'BARCODE')
    else if (msg.event === 'QR_SCANNED' || msg.event === 'BARCODE_DETECTED') {

        // Cập nhật mã hiển thị
        this.scannedCode.set(msg.data?.code || msg.data);

        // (Tuỳ chọn) Tự động ẩn sau 5 giây nếu không quét mới
        clearTimeout(this.scanResetTimer);
        this.scanResetTimer = setTimeout(() => this.scannedCode.set(null), 5000);
    }
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

  onImageError(event: Event) { }

  disconnect() {
    this.isStreaming.set(false);
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe();
  }

  toggleFullscreen(event?: Event) {
    event?.stopPropagation();
    const elem = this.viewportRef.nativeElement;
    !document.fullscreenElement ? elem.requestFullscreen() : document.exitFullscreen();
  }
}

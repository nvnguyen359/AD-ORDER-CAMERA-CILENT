import { Component, Input, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StreamService, StreamMessage } from '../../core/services/stream.service';
import { VisualizerDirective } from '../../features/live-cameras/visualizer.directive';
// Directive đã tạo ở Giai đoạn 2

@Component({
  selector: 'app-camera-widget',
  standalone: true,
  imports: [CommonModule, VisualizerDirective],
  templateUrl: './camera-widget.component.html',
  styleUrls: ['./camera-widget.component.scss']
})
export class CameraWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) cameraId!: number;
  @Input() cameraName: string = 'Camera';

  private streamService = inject(StreamService);
  private sub: Subscription | null = null;

  // Signals để quản lý State (Thay đổi UI tự động)
  isConnected = signal<boolean>(false);
  isRecording = signal<boolean>(false); // Hiệu ứng viền đỏ khi có đơn hàng
  imageBase64 = signal<string>('');
  metadata = signal<any[]>([]);

  // Dùng cho visualizer directive để resize canvas
  imgWidth = 0;
  imgHeight = 0;

  @ViewChild('viewport') viewportRef!: ElementRef;

  ngOnInit(): void {
    // 1. Subscribe vào luồng dữ liệu RIÊNG của camera này
    this.sub = this.streamService.getCameraStream(this.cameraId).subscribe({
      next: (msg: StreamMessage) => this.handleMessage(msg)
    });

    // Mặc định bật kết nối khi init (nếu muốn)
    this.connect();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Xử lý gói tin từ Socket
  private handleMessage(msg: StreamMessage) {
    // A. Nếu là ảnh stream
    if (msg.image) {
        this.isConnected.set(true);
        this.imageBase64.set(`data:image/jpeg;base64,${msg.image}`);
        this.metadata.set(msg.metadata || []);
    }

    // B. Nếu là sự kiện Đơn hàng (Order Event)
    if (msg.event === 'ORDER_CREATED') {
        this.isRecording.set(true);
    } else if (msg.event === 'ORDER_STOPPED') {
        this.isRecording.set(false);
    }
  }

  // Xử lý sự kiện khi ảnh load xong -> Lấy kích thước thật để vẽ Canvas chuẩn
  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    this.imgWidth = img.naturalWidth;
    this.imgHeight = img.naturalHeight;
  }

  // --- ACTIONS ---

  connect() {
    this.streamService.toggleCamera(this.cameraId, 'connect').subscribe();
  }

  disconnect() {
    this.streamService.toggleCamera(this.cameraId, 'disconnect').subscribe(() => {
        // Reset UI khi tắt
        this.isConnected.set(false);
        this.imageBase64.set('');
        this.metadata.set([]);
    });
  }

  changeMode(event: Event) {
    const mode = (event.target as HTMLSelectElement).value;
    this.streamService.changeMode(this.cameraId, mode);
  }

  toggleFullscreen() {
    const elem = this.viewportRef.nativeElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch((err: any) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  }
}

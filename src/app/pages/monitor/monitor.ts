import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../core/services/storage.service';
import { StreamService } from '../../core/services/stream.service';
import { environment } from '../../environments/environment';
import { CameraWidgetComponent } from '../../components/camera-widget.component/camera-widget.component';

@Component({
  selector: 'app-monitor',
  imports: [CommonModule,CameraWidgetComponent],
  templateUrl: './monitor.html',
  styleUrl: './monitor.scss',
  standalone: true,
})
export class Monitor implements OnInit, OnDestroy {
  private streamService = inject(StreamService);
  private storageService = inject(StorageService);

  cameras = signal<any[]>([]);

  ngOnInit(): void {
    // 1. Lấy danh sách Camera từ API
    this.streamService.getCameras().subscribe({
      next: (res: any) => {
        // Giả sử API trả về { data: [...] } như file main.js cũ
        this.cameras.set(res.data || []);
      },
      error: (err) => console.error('Failed to load cameras', err)
    });

    // 2. Kích hoạt WebSocket tổng (Quan trọng!)
    const token = this.storageService.getItem(environment.ACCESS_TOKEN_KEY);
    if (token) {
        this.streamService.connectSocket(token);
    } else {
        alert("Thiếu Token! Vui lòng kiểm tra lại cấu hình.");
    }
  }

  ngOnDestroy(): void {
    // Rời trang thì ngắt socket để tiết kiệm băng thông
    this.streamService.disconnectSocket();
  }
}

import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CameraService } from '../../core/services/camera.service';
import { StreamService } from '../../core/services/stream.service';
import { OrderService } from '../../core/services/order.service'; // 1️⃣ Import OrderService
import { StorageService } from '../../core/services/storage.service';
import { environment } from '../../environments/environment';

import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ActivityStatsComponent } from '../../components/activity-stats.component/activity-stats.component';
import { CameraWidgetComponent } from '../../components/camera-widget.component/camera-widget.component';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [
    CommonModule,
    CameraWidgetComponent,
    ActivityStatsComponent,
    ButtonModule,
    TooltipModule,
    ScrollPanelModule,
  ],
  templateUrl: './monitor.html',
  styleUrls: ['./monitor.scss'],
})
export class MonitorComponent implements OnInit, OnDestroy {
  private cameraService = inject(CameraService);
  private streamService = inject(StreamService);
  private storageService = inject(StorageService);
  private orderService = inject(OrderService); // 2️⃣ Inject OrderService

  // --- SIGNALS ---
  cameras = signal<any[]>([]);
  selectedCamera = signal<any>(null);
  isLoading = signal<boolean>(false);
  activePackingOrders = signal<any[]>([]);

  private sub: Subscription | null = null;

  ngOnInit() {
    const token = this.storageService.getItem(environment.ACCESS_TOKEN_KEY) || '';

    // 1. Kết nối Socket
    this.streamService.connectSocket(token);

    // 2. Load Cameras (Và sau đó sẽ load Active Orders)
    this.loadCameras();

    // 3. Lắng nghe Socket cho các sự kiện REAL-TIME
    this.sub = this.streamService.messages$.subscribe((msg: any) => {
      this.handleSocketMessage(msg);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.streamService.disconnectSocket();
  }

  loadCameras() {
    this.cameraService.getAllCameras().subscribe((res) => {
      setTimeout(() => {
        this.cameras.set(res.data);

        // Tự động chọn cam đầu tiên nếu chưa chọn
        if (!this.selectedCamera() && res.data.length > 0) {
          this.selectCamera(res.data[0]);
        }

        // 3️⃣ [QUAN TRỌNG] Sau khi có danh sách Camera (để lấy tên), ta load đơn đang chạy
        this.loadInitialActiveOrders();
      }, 0);
    });
  }

  // 4️⃣ Hàm mới: Lấy lại các đơn hàng đang đóng gói từ DB
  loadInitialActiveOrders() {
    // Gọi API lấy đơn có status = 'packing'
    this.orderService.getOrders({ status: 'packing', pageSize: 100 }).subscribe({
      next: (res) => {
        if (res.data) {
          const mappedOrders = res.data.map((order: any) => ({
            camera_id: order.camera_id,
            // Tìm tên camera dựa vào ID
            camera_name: this.cameras().find((c) => c.id === order.camera_id)?.name || `Cam ${order.camera_id}`,
            code: order.code,
            order_id: order.id,
            start_time: new Date(order.created_at), // Hoặc order.start_at
            avatar: this.resolveAvatar(order.path_avatar || order.full_avatar_path)
          }));

          // Cập nhật vào Signal
          this.activePackingOrders.set(mappedOrders);
        }
      },
      error: (err) => console.error('Không thể tải đơn hàng đang chạy:', err)
    });
  }

  selectCamera(cam: any) {
    const prevCam = this.selectedCamera();
    if (prevCam && prevCam.id === cam.id) return;

    if (prevCam) {
      this.streamService.toggleCamera(prevCam.id, 'disconnect').subscribe();
    }

    this.selectedCamera.set(null);
    this.isLoading.set(true);

    this.streamService.toggleCamera(cam.id, 'connect').subscribe({
      next: () => {
        this.selectedCamera.set(cam);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi bật camera:', err);
        this.isLoading.set(false);
      },
    });
  }

  // --- LOGIC SOCKET ---
  private handleSocketMessage(msg: any) {
    if (!msg || !msg.event) return;

    if (msg.event === 'ORDER_CREATED') {
      const data = msg.data || {};
      const newOrder = {
        camera_id: msg.camera_id,
        camera_name: this.cameras().find((c) => c.id === msg.camera_id)?.name || `Cam ${msg.camera_id}`,
        code: data.code,
        order_id: data.order_id,
        start_time: new Date(),
        avatar: this.resolveAvatar(data.path_avatar || data.avatar),
      };
      this.activePackingOrders.update((list) => [newOrder, ...list]);

    } else if (msg.event === 'ORDER_STOPPED') {
      this.activePackingOrders.update((list) =>
        list.filter((item) => item.order_id !== msg.data.order_id)
      );

    } else if (msg.event === 'ORDER_UPDATED') {
      const data = msg.data || {};
      const newAvatar = this.resolveAvatar(data.path_avatar || data.avatar);

      this.activePackingOrders.update((list) =>
        list.map((item) => {
          if (item.order_id === data.order_id) {
             return { ...item, avatar: newAvatar || item.avatar };
          }
          return item;
        })
      );
    }
  }

  // 5️⃣ Helper dùng chung để fix lỗi ảnh 404
  private resolveAvatar(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;

    // Xử lý path tương đối (OC_System_Data/...)
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const apiUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;

    return `${apiUrl}/${cleanPath}`;
  }
}

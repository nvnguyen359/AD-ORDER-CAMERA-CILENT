import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ScrollPanelModule } from 'primeng/scrollpanel';

import { CameraService } from '../../core/services/camera.service';
import { StreamService } from '../../core/services/stream.service';
import { OrderService } from '../../core/services/order.service';
import { StorageService } from '../../core/services/storage.service';
import { environment } from '../../environments/environment';
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
  private orderService = inject(OrderService);

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

    // 3. Lắng nghe Socket
    this.sub = this.streamService.messages$.subscribe((msg: any) => {
      this.handleSocketMessage(msg);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.streamService.disconnectSocket();
  }

  loadCameras() {
    this.cameraService.getAllCameras().subscribe((res: any) => {
      setTimeout(() => {
        // [FIX AN TOÀN] Kiểm tra cấu trúc trả về của Camera API
        // Nếu API trả về { data: [...] } hoặc { data: { items: [...] } }
        let rawData = [];
        if (Array.isArray(res.data)) {
            rawData = res.data;
        } else if (res.data && Array.isArray(res.data.items)) {
            rawData = res.data.items;
        } else {
            rawData = res.data ? [res.data] : [];
        }

        const processedCameras = rawData.map((e: any) => {
          e.display_name = e.display_name ? e.display_name : e.name;
          return e;
        });

        this.cameras.set(processedCameras);

        // Tự động chọn cam đầu tiên nếu chưa chọn
        if (!this.selectedCamera() && processedCameras.length > 0) {
          this.selectCamera(processedCameras[0]);
        }

        // Sau khi có danh sách Camera, load đơn đang chạy
        this.loadInitialActiveOrders();
      }, 0);
    });
  }

  // [FIX CHÍNH] Hàm này bị lỗi map is not a function
  loadInitialActiveOrders() {
    // 1. Đổi pageSize -> limit (cho khớp Python Backend)
    this.orderService.getOrders({ status: 'packing', limit: 100 }).subscribe({
      next: (res: any) => {
        // 2. [FIX] Lấy dữ liệu từ .items
        const orders = res.data?.items || [];

        if (orders.length > 0) {
          const mappedOrders = orders.map((order: any) => ({
            camera_id: order.camera_id,
            // Tìm tên camera dựa vào ID
            camera_name: this.cameras().find((c) => c.id === order.camera_id)?.name || `Cam ${order.camera_id}`,
            code: order.code,
            order_id: order.id,
            start_time: new Date(order.created_at),
            avatar: this.resolveAvatar(order.path_avatar || order.full_avatar_path)
          }));

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
      // Dùng data.order_id hoặc order_id trực tiếp tùy message
      const stopId = msg.data?.order_id || msg.order_id;
      this.activePackingOrders.update((list) =>
        list.filter((item) => item.order_id !== stopId)
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

  private resolveAvatar(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;

    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // Đảm bảo không bị double slash
    const apiUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;

    return `${apiUrl}/${cleanPath}`;
  }
}

import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
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
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // --- SIGNALS ---
  cameras = signal<any[]>([]);
  selectedCamera = signal<any>(null);
  isLoading = signal<boolean>(false);
  activePackingOrders = signal<any[]>([]); // Danh sách realtime
  isListLoading = signal<boolean>(false);

  private sub: Subscription | null = null;
  private isTimerPending = false;

  ngOnInit() {
    const token = this.storageService.getItem(environment.ACCESS_TOKEN_KEY) || '';

    this.streamService.connectSocket(token);
    this.loadCameras();

    // Load lần đầu tiên khi vào trang
    this.loadInitialActiveOrders();

    this.sub = this.streamService.messages$.subscribe((msg: any) => {
      this.zone.run(() => {
        this.handleSocketMessage(msg);
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.streamService.disconnectSocket();
  }

  trackByOrder(index: number, item: any): number {
    return item.order_id;
  }

  loadCameras() {
    this.cameraService.getAllCameras().subscribe((res: any) => {
      let rawData = [];
      if (Array.isArray(res.data)) rawData = res.data;
      else if (res.data && Array.isArray(res.data.items)) rawData = res.data.items;
      else rawData = res.data ? [res.data] : [];

      const processedCameras = rawData.map((e: any) => {
        e.display_name = e.display_name ? e.display_name : e.name;
        return e;
      });

      this.cameras.set(processedCameras);
      if (!this.selectedCamera() && processedCameras.length > 0) {
        this.selectCamera(processedCameras[0]);
      }
    });
  }

  loadInitialActiveOrders() {
    this.isListLoading.set(true);
    this.fetchOrders(true);
  }

  // Vẫn giữ hàm này để đồng bộ dữ liệu nếu cần thiết (backup)
  reloadListSilent() {
    this.fetchOrders(false);
  }

  private fetchOrders(showLoading: boolean) {
    this.orderService
      .getOrders({
        status: 'packing',
        limit: 100,
        sort_by: 'created_at',
        sort_dir: 'desc',
      })
      .subscribe({
        next: (res: any) => {
          const orders = res.data?.items || [];
          const mappedOrders = orders.map((order: any) => ({
            camera_id: order.camera_id,
            camera_name: this.getCameraName(order.camera_id),
            code: order.code,
            order_id: order.id,
            start_time: order.created_at,
            avatar: this.resolveAvatar(order.path_avatar || order.full_avatar_path),
          }));

          const currentData = JSON.stringify(this.activePackingOrders());
          const newData = JSON.stringify(mappedOrders);

          if (currentData !== newData) {
            this.activePackingOrders.set(mappedOrders);
            this.cdr.detectChanges();
          }
          if (showLoading) this.isListLoading.set(false);
        },
        error: (err) => {
          console.error('Lỗi tải đơn hàng:', err);
          if (showLoading) this.isListLoading.set(false);
        },
      });
  }

  selectCamera(cam: any) {
    const prevCam = this.selectedCamera();
    if (prevCam && prevCam.id === cam.id) return;

    this.selectedCamera.set(null);
    this.isLoading.set(true);

    setTimeout(() => {
      this.selectedCamera.set(cam);
      this.isLoading.set(false);
    }, 50);
  }

  // --- XỬ LÝ SOCKET REALTIME (LOGIC MỚI) ---
  private handleSocketMessage(msg: any) {
    if (!msg || !msg.event) return;

    // Backend gửi cấu trúc: { event: "...", payload: { ... } }
    const payload = msg.payload || msg.data || {};

    // 1. CÓ ĐƠN HÀNG MỚI -> THÊM VÀO ĐẦU LIST
    if (msg.event === 'ORDER_CREATED') {
      const newOrder = {
        camera_id: payload.cam_id,
        camera_name: this.getCameraName(payload.cam_id),
        code: payload.code,
        order_id: payload.order_id,
        start_time: new Date(payload.start_time).toISOString(), // Backend gửi timestamp ms
        avatar: null // Mới tạo chưa có ảnh
      };

      // Cập nhật Signal: Thêm vào đầu mảng
      this.activePackingOrders.update(current => {
        // Kiểm tra trùng lặp (đề phòng mạng lag socket bắn 2 lần)
        if (current.some(o => o.code === newOrder.code)) return current;
        return [newOrder, ...current];
      });

      console.log(`🚀 [Socket] New Order: ${newOrder.code}`);
    }

    // 2. ĐƠN HÀNG KẾT THÚC -> XÓA KHỎI LIST
    else if (msg.event === 'ORDER_STOPPED') {
      const codeToRemove = payload.code;
      if (codeToRemove) {
        this.activePackingOrders.update(current =>
          current.filter(o => o.code !== codeToRemove)
        );
        console.log(`🛑 [Socket] Removed Order: ${codeToRemove}`);
      } else {
        // Fallback: Nếu không có code, reload lại cho chắc
        this.reloadListSilent();
      }
    }

    // 3. CẬP NHẬT ẢNH (SNAPSHOT) -> UPDATE LIST
    else if (msg.event === 'ORDER_UPDATED') {
      const orderId = payload.order_id;
      const newAvatarPath = payload.path_avatar;

      if (orderId && newAvatarPath) {
        this.activePackingOrders.update(current =>
          current.map(o => {
            if (o.order_id === orderId) {
              return { ...o, avatar: this.resolveAvatar(newAvatarPath) };
            }
            return o;
          })
        );
      }
    }

    // 4. Fallback cho các sự kiện khác (QR_SCANNED...)
    else if (msg.event === 'QR_SCANNED') {
       // Logic cũ nếu cần
    }
  }

  // --- HELPERS ---
  private getCameraName(id: number): string {
    const found = this.cameras().find((c) => c.id == id);
    return found ? found.display_name || found.name : `Cam ${id}`;
  }

  private resolveAvatar(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const apiUrl = environment.apiUrl.endsWith('/')
      ? environment.apiUrl.slice(0, -1)
      : environment.apiUrl;
    return `${apiUrl}/${cleanPath}`;
  }
}

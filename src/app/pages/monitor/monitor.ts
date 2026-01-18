import { Component, OnInit, OnDestroy, signal, inject, NgZone, ChangeDetectorRef } from '@angular/core';
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
  activePackingOrders = signal<any[]>([]);
  isListLoading = signal<boolean>(false);

  private sub: Subscription | null = null;
  private isTimerPending = false;

  ngOnInit() {
    const token = this.storageService.getItem(environment.ACCESS_TOKEN_KEY) || '';

    this.streamService.connectSocket(token);
    this.loadCameras();

    // Load lần đầu (có loading spinner)
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

  // --- HÀM GIÚP ANGULAR NHẬN BIẾT ITEM NÀO THAY ĐỔI ---
  // [QUAN TRỌNG] Giúp loại bỏ hiện tượng nháy hình
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

  // Load có loading spinner (Dùng cho nút Refresh thủ công hoặc lần đầu)
  loadInitialActiveOrders() {
    this.isListLoading.set(true);
    this.fetchOrders(true);
  }

  // [FIX] Reload ngầm, không hiện spinner, có so sánh dữ liệu
  reloadListSilent() {
    this.fetchOrders(false);
  }

  // Hàm gọi API chung
  private fetchOrders(showLoading: boolean) {
    this.orderService.getOrders({
        status: 'packing',
        limit: 100,
        sort_by: 'created_at',
        sort_dir: 'desc'
    }).subscribe({
      next: (res: any) => {
        const orders = res.data?.items || [];

        const mappedOrders = orders.map((order: any) => ({
            camera_id: order.camera_id,
            camera_name: this.getCameraName(order.camera_id),
            code: order.code,
            order_id: order.id,
            start_time: order.created_at,
            avatar: this.resolveAvatar(order.path_avatar || order.full_avatar_path)
        }));

        // [LOGIC UPDATE THÔNG MINH]
        // Chuyển sang JSON string để so sánh nhanh xem có gì thay đổi không
        // Nếu y hệt dữ liệu cũ -> KHÔNG set lại signal -> KHÔNG render lại -> KHÔNG nháy
        const currentData = JSON.stringify(this.activePackingOrders());
        const newData = JSON.stringify(mappedOrders);

        if (currentData !== newData) {
            console.log('⚡ Data changed -> Updating UI');
            this.activePackingOrders.set(mappedOrders);
            this.cdr.detectChanges();
        } else {
            // console.log('💤 Data same -> Skip update');
        }

        if (showLoading) this.isListLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi tải đơn hàng:', err);
        if (showLoading) this.isListLoading.set(false);
      }
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

  private handleSocketMessage(msg: any) {
    if (!msg || !msg.event) return;

    // 1. ORDER EVENTS -> Reload Ngầm
    if (msg.event === 'ORDER_CREATED' || msg.event === 'ORDER_STOPPED' || msg.event === 'ORDER_UPDATED') {
        // Gọi reload ngầm, không set loading spinner
        this.reloadListSilent();
        this.isTimerPending = false;
    }

    // 2. QR_SCANNED (Backup) -> Reload Ngầm
    else if (msg.event === 'QR_SCANNED') {
        if (this.isTimerPending) return;
        this.isTimerPending = true;

        setTimeout(() => {
            this.reloadListSilent();
            this.isTimerPending = false;
        }, 2000);
    }
  }

  // --- HELPERS ---
  private getCameraName(id: number): string {
      const found = this.cameras().find(c => c.id == id);
      return found ? (found.display_name || found.name) : `Cam ${id}`;
  }

  private resolveAvatar(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const apiUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    return `${apiUrl}/${cleanPath}`;
  }
}

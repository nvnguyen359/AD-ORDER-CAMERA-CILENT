import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  effect,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { TooltipModule } from 'primeng/tooltip';

import { OrderService } from '../../core/services/order.service';
import { environment } from '../../environments/environment';
import { OrderStatusPipe } from '../../shared/pipes/order-status-pipe';
// [FIX] 1. Import SettingsService
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    CardModule,
    AvatarModule,
    DividerModule,
    SkeletonModule,
    ScrollPanelModule,
    TooltipModule,
    OrderStatusPipe,
  ],
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.scss'],
})
export class OrderDetailComponent implements OnInit, OnChanges {
  @Input() inputCode: string | null = null;
  @Input() isDialogMode: boolean = false;

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private location = inject(Location);
  private http = inject(HttpClient);
  // [FIX] 2. Inject SettingsService
  private settingsService = inject(SettingsService);

  loading = signal<boolean>(true);
  isDownloading = signal<boolean>(false);
  orderList = signal<any[]>([]);
  selectedOrder = signal<any>(null);

  isPlaying = signal<boolean>(false);
  durationString = signal<string>('');

  // [FIX] 3. Thêm Signal lưu tỉ lệ khung hình (Mặc định 16/9)
  // Biến này sẽ được bind vào [style.aspect-ratio] bên HTML
  aspectRatio = signal<string>('16 / 9');

  constructor() {
    effect(() => {
      const current = this.selectedOrder();
      if (current) this.calculateDuration(current.start_at, current.closed_at);
    });
  }

  ngOnInit() {
    // [FIX] 4. Gọi API lấy cấu hình width/height để tính tỉ lệ
    this.settingsService.getSettings().subscribe({
      next: (settings: any) => {
        // settings trả về object dạng { camera_width: "...", ... }
        const w = Number(settings['camera_width']);
        const h = Number(settings['camera_height']);

        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            // Cập nhật aspect-ratio theo đúng cấu hình hệ thống
            this.aspectRatio.set(`${w} / ${h}`);
        }
      },
      error: (err) => console.warn('Không thể tải settings, dùng tỉ lệ mặc định.', err)
    });

    // Logic cũ giữ nguyên
    if (this.inputCode) {
      this.fetchOrders(this.inputCode);
    } else {
      const routeCode = this.route.snapshot.paramMap.get('code');
      if (routeCode) this.fetchOrders(routeCode);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inputCode'] && !changes['inputCode'].firstChange) {
      if (this.inputCode) this.fetchOrders(this.inputCode);
    }
  }

  fetchOrders(code: string) {
    this.loading.set(true);

    this.orderService.getOrders({ code: code, page: 1, page_size: 100 }).subscribe({
      next: (res: any) => {
        const responseData = res.data || {};
        let list = responseData.items || [];

        if (!list.length && Array.isArray(responseData)) {
            list = responseData;
        } else if (!list.length && responseData.data && Array.isArray(responseData.data)) {
            list = responseData.data;
        }

        this.orderList.set(list);

        const playIdStr = this.route.snapshot.queryParamMap.get('playId');
        let targetOrder = null;

        if (playIdStr && list.length > 0) {
          const playId = Number(playIdStr);
          targetOrder = list.find((item: { id: number }) => item.id === playId);
        }

        if (!targetOrder && list.length > 0) {
          targetOrder = list[0];
        }

        if (targetOrder) {
          this.selectOrder(targetOrder, true);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Order Detail API Error:', err);
        this.orderList.set([]);
        this.loading.set(false);
      },
    });
  }

  handleItemClick(order: any) {
    if (this.selectedOrder()?.id === order.id) {
      this.toggleVideoState();
    } else {
      this.selectOrder(order, true);
    }
  }

  selectOrder(order: any, autoPlay: boolean = false) {
    this.selectedOrder.set(order);
    this.isPlaying.set(false);

    if (autoPlay && this.videoPlayer) {
      setTimeout(() => {
        const vid = this.videoPlayer.nativeElement;
        vid.load();
        vid.play().catch(() => {});
      }, 100);
    }
  }

  toggleVideoState() {
    if (!this.videoPlayer) return;
    const vid = this.videoPlayer.nativeElement;
    if (vid.paused) {
      vid.play();
    } else {
      vid.pause();
    }
  }

  onVideoPlay() {
    this.isPlaying.set(true);
  }
  onVideoPause() {
    this.isPlaying.set(false);
  }
  onVideoEnded() {
    this.isPlaying.set(false);
  }

  downloadVideo(order: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!order?.path_video) return;

    this.isDownloading.set(true);
    const url = this.getFullUrl(order.path_video);
    const fileName = `${order.code}_${order.id}.mp4`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        this.isDownloading.set(false);
      },
      error: (err) => {
        console.error('Lỗi khi tải video:', err);
        this.isDownloading.set(false);
        window.open(url, '_blank');
      }
    });
  }

  downloadAllVideos() {
    const list = this.orderList();
    if (!list || list.length === 0) return;

    if (!confirm(`Tải xuống ${list.length} video?`)) return;

    let delay = 0;
    list.forEach((item) => {
      if (item.path_video) {
        setTimeout(() => {
          this.downloadVideo(item);
        }, delay);
        delay += 1500;
      }
    });
  }

  getFullUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    const baseUrl = environment.apiUrl.endsWith('/')
        ? environment.apiUrl.slice(0, -1)
        : environment.apiUrl;

    const relative = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${relative}`;
  }

  calculateDuration(start: string, end: string) {
    if (!start || !end) {
      this.durationString.set('--:--');
      return;
    }
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const min = Math.floor(diff / 60);
    const sec = diff % 60;
    this.durationString.set(`${min}p ${sec}s`);
  }

  getStatusIcon(status: string): string {
    switch (status?.toLowerCase()) {
      case 'packed': return 'pi pi-check-circle';
      case 'cancelled': return 'pi pi-times-circle';
      case 'processing': return 'pi pi-spin pi-spinner';
      default: return 'pi pi-info-circle';
    }
  }

  getSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    switch (status?.toLowerCase()) {
      case 'packed': return 'success';
      case 'cancelled': return 'danger';
      case 'processing': return 'info';
      default: return 'warn';
    }
  }

  goBack() {
   if (!this.isDialogMode) {
      if (window.history.length > 1) {
        this.location.back();
      } else {
        this.router.navigate(['/']);
      }
    }
  }
}

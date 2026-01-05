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
import { HttpClient } from '@angular/common/http'; // [1] Import HttpClient
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
  private http = inject(HttpClient); // [2] Inject HttpClient

  loading = signal<boolean>(true);
  isDownloading = signal<boolean>(false); // Thêm trạng thái đang tải
  orderList = signal<any[]>([]);
  selectedOrder = signal<any>(null);

  isPlaying = signal<boolean>(false);
  durationString = signal<string>('');

  constructor() {
    effect(() => {
      const current = this.selectedOrder();
      if (current) this.calculateDuration(current.start_at, current.closed_at);
    });
  }

  ngOnInit() {
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
    const apiCall = (this.orderService as any).getOrderFamily
      ? (this.orderService as any).getOrderFamily(code)
      : this.orderService.getOrders({ code: code });

    apiCall.subscribe({
      next: (res: any) => {
        if (res.code === 200 && res.data) {
          let list = [];
          if (Array.isArray(res.data)) list = res.data;
          else if (res.data.data && Array.isArray(res.data.data)) list = res.data.data;
          else list = [res.data];

          this.orderList.set(list);

          // Auto Play logic
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
        } else {
          this.orderList.set([]);
        }
        this.loading.set(false);
      },
      error: () => {
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

  // --- [FIX] DOWNLOAD VIDEO: SỬ DỤNG BLOB ĐỂ ÉP TẢI VỀ ---
  downloadVideo(order: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!order?.path_video) return;

    this.isDownloading.set(true); // Bật loading nếu cần hiển thị spinner
    const url = this.getFullUrl(order.path_video);
    const fileName = `${order.code}_${order.id}.mp4`;

    // Gọi HTTP Request để lấy file dưới dạng Blob (Nhị phân)
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Tạo URL ảo từ Blob
        const objectUrl = URL.createObjectURL(blob);

        // Tạo thẻ a ảo để click tải về
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        // Dọn dẹp
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        this.isDownloading.set(false);
      },
      error: (err) => {
        console.error('Lỗi khi tải video:', err);
        this.isDownloading.set(false);
        // Fallback: Nếu lỗi Blob (VD: CORS chặn), đành mở tab mới
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

  // --- HÀM URL CŨ (GIỮ NGUYÊN NHƯ LÚC HOẠT ĐỘNG TỐT) ---
  getFullUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Logic cũ: Chỉ ghép baseURL + path
    const baseUrl = environment.apiUrl.endsWith('/')
        ? environment.apiUrl.slice(0, -1)
        : environment.apiUrl;

    // Đảm bảo path bắt đầu bằng /
    const relative = path.startsWith('/') ? path : `/${path}`;

    // Nếu path trong DB có dạng 'data/videos...', cần đảm bảo URL khớp với mount của server cũ
    // (Thường bạn mount root hoặc data nên ghép thẳng là chạy được video)
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

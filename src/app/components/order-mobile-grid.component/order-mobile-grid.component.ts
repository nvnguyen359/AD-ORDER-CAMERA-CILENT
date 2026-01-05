import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ImageModule } from 'primeng/image';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

// Models & Services
import { Order, OrderGroupViewModel } from '../../core/models/order';
import { OrderService } from '../../core/services/order.service';
import { environment } from '../../environments/environment';

// Pipes
import { FormatDatePipe } from '../../shared/pipes/format-date-pipe';
import { OrderStatusPipe } from '../../shared/pipes/order-status-pipe';
import { TimeFormatPipe } from '../../shared/pipes/time-format-pipe';

@Component({
  selector: 'app-order-mobile-grid',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, IconFieldModule, InputIconModule,
    TagModule, PaginatorModule, ImageModule, SkeletonModule,
    OrderStatusPipe, TimeFormatPipe
  ],
  templateUrl: './order-mobile-grid.component.html',
  styleUrls: ['./order-mobile-grid.component.scss']
})
export class OrderMobileGridComponent implements OnInit {
  // Signals
  orderGroups = signal<OrderGroupViewModel[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(true);

  // Pagination & Filter
  first = signal<number>(0);
  rows = signal<number>(10); // Mobile nên load ít hơn (10 items)
  searchValue = signal<string>('');

  private searchSubject = new Subject<string>();
  private activeFilters: any = {};
  readonly MEDIA_URL = environment.apiUrl.endsWith('/') ? environment.apiUrl : `${environment.apiUrl}/`;

  constructor(private service: OrderService) {}

  ngOnInit() {
    // Restore state từ history (nếu back từ chi tiết về)
    const state = history.state;
    if (state?.code) {
      this.activeFilters.code = state.code;
      this.searchValue.set(state.code);
    }

    // Setup Search
    this.searchSubject.pipe(
      debounceTime(600), // Tăng delay xíu cho mobile đỡ giật khi gõ
      distinctUntilChanged()
    ).subscribe(value => {
      this.activeFilters.code = value || undefined;
      this.first.set(0);
      this.loadOrders();
    });

    this.loadOrders();
  }

  async loadOrders() {
    this.loading.set(true);
    try {
      const params = {
        page_size: this.rows(),
        page: Math.floor(this.first() / this.rows()),
        ...this.activeFilters
      };

      const response = await lastValueFrom(this.service.getOrders(params)) as any;

      if (response && response.code === 200) {
        // 1. Pre-process Data
        const processedData = response.data.map((item: Order) => ({
          ...item,
          full_avatar_path: item.path_avatar
            ? (item.path_avatar.startsWith('http') ? item.path_avatar : this.MEDIA_URL + item.path_avatar)
            : 'assets/images/no-avatar.png',
          duration: this.calculateItemDuration(item.start_at, item.closed_at)
        }));

        // 2. Transform to Groups
        const groups = this.transformToGroups(processedData);

        this.orderGroups.set(groups);
        this.totalRecords.set(response.total);
      } else {
        this.orderGroups.set([]);
        this.totalRecords.set(0);
      }
    } catch (error) {
      console.error('Mobile Load Error:', error);
      this.orderGroups.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  // --- LOGIC GOM NHÓM (Dùng chung logic với Desktop) ---
  private transformToGroups(orders: Order[]): OrderGroupViewModel[] {
    const groupMap = new Map<number, Order[]>();

    orders.forEach(order => {
      const rootId = order.parent_id || order.id;
      if (!groupMap.has(rootId)) groupMap.set(rootId, []);
      groupMap.get(rootId)?.push(order);
    });

    const result: OrderGroupViewModel[] = [];

    groupMap.forEach((items, rootId) => {
      // Sort items: Cũ -> Mới
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const parentOrder = items.find(i => i.id === rootId) || items[0];
      const latestItem = items[items.length - 1];

      // Tính Total Duration
      const minCreated = new Date(items[0].created_at).getTime();
      let maxClosed = 0;
      const isRunning = items.some(i => !i.closed_at);

      if (isRunning) {
        maxClosed = Date.now();
      } else {
        maxClosed = items.reduce((max, i) => i.closed_at ? Math.max(max, new Date(i.closed_at).getTime()) : max, 0);
      }

      const durationSecs = Math.floor((maxClosed - minCreated) / 1000);

      result.push({
        groupId: rootId,
        displayCode: parentOrder.code || 'NO-CODE',
        latestStatus: latestItem.status,
        latestDate: new Date(latestItem.created_at),
        totalItems: items.length,
        durationText: this.formatDurationSeconds(durationSecs),
        items: items,
        isExpanded: false, // Mobile mặc định đóng
        hasVideo: items.some(i => !!i.path_video)
      });
    });

    // Sort Groups: Mới nhất lên đầu
    return result.sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
  }

  // --- UI Handlers ---
  onPageChange(event: PaginatorState) {
    this.first.set(event.first || 0);
    this.rows.set(event.rows || 10);
    this.loadOrders();

    // Scroll lên đầu khi chuyển trang
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchValue.set(val);
    this.searchSubject.next(val);
  }

  toggleGroup(group: OrderGroupViewModel) {
    group.isExpanded = !group.isExpanded;
  }

  // --- Helpers ---
  getSeverity(status: string) {
    switch (status) {
      case 'packed': return 'success';
      case 'packing': return 'warn';
      case 'cancelled': return 'danger';
      default: return 'info';
    }
  }

  private calculateItemDuration(start?: string, end?: string): string {
    if (!start) return '--';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    return this.formatDurationSeconds(Math.floor((e - s) / 1000));
  }

  private formatDurationSeconds(s: number): string {
    if (s < 0) return '0s';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}p${sec}` : `${sec}s`;
  }
}

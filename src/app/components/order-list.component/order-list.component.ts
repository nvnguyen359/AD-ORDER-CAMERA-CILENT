import { Component, signal, OnInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

// PrimeNG & Core
import { TableModule, TableLazyLoadEvent, Table } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ImageModule } from 'primeng/image';

// Models & Pipes & Services
import { Order } from '../../core/models/order';
import { FormatDatePipe } from '../../shared/pipes/format-date-pipe';
import { OrderService } from '../../core/services/order.service';
import { environment } from '../../environments/environment';
import { OrderStatusPipe } from '../../shared/pipes/order-status-pipe';
import { TimeFormatPipe } from '../../shared/pipes/time-format-pipe';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ImageModule,
    FormatDatePipe,
    OrderStatusPipe,
    TimeFormatPipe,
  ],
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss'],
})
export class OrderListComponent implements OnInit {
  // Truy cập Table thông qua ViewChild (Cần thêm #dt bên HTML)
  @ViewChild('dt') dt!: Table;

  // Signals quản lý state
  orders = signal<Order[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(true);
  @Output() playVideo = new EventEmitter<any>();
  // Signal cho ô tìm kiếm
  searchValue = signal<string>('');

  // Subject để xử lý tìm kiếm có độ trễ (Debounce)
  private searchSubject = new Subject<string>();

  // Biến lưu các bộ lọc active
  private activeFilters: any = {};
  filterData!: any;
  readonly MEDIA_URL = environment.apiUrl.endsWith('/')
    ? environment.apiUrl
    : `${environment.apiUrl}/`;

  // Thông số mặc định
  rows = signal<number>(20);

  constructor(private service: OrderService) {}

  ngOnInit() {
    this.playVideo.emit({init:0})
    // 1. Kiểm tra dữ liệu từ History State (khi chuyển trang từ Dashboard/History)
    const state = history.state;

    if (state) {
      if (state.datePreset) {
        this.activeFilters.date_preset = state.datePreset;
      }
      if (state.code) {
        this.activeFilters.code = state.code;
        this.searchValue.set(state.code);
      }
    }

    // 2. Thiết lập luồng tìm kiếm (Debounce 500ms)
    this.searchSubject.pipe(debounceTime(500), distinctUntilChanged()).subscribe((value) => {
      // Cập nhật bộ lọc active
      if (value) {
        this.activeFilters.code = value;
      } else {
        delete this.activeFilters.code;
      }

      // Reset bảng về trang 1 -> Tự động kích hoạt onLazyLoad
      if (this.dt) {
        this.dt.reset();
      }
    });
  }

  /**
   * Hàm load dữ liệu chính (Lazy Load)
   * Được gọi tự động khi:
   * 1. Table khởi tạo (lazy=true)
   * 2. Người dùng chuyển trang/sort
   * 3. Gọi lệnh this.dt.reset()
   */
  async loadOrders(event?: TableLazyLoadEvent) {
    this.loading.set(true);

    try {
      // 1. Lấy params từ Table
      const tableParams = event || {};

      // 2. Merge với activeFilters (Ưu tiên filters đang active)
      const params = {
        ...tableParams,
        ...this.activeFilters,
      };

      // 3. Gọi API
      const response = (await lastValueFrom(this.service.getOrders(params))) as any;
      this.filterData = { id: null, data: response };
      if (response && response.code === 200) {
        const processedData = response.data.map((item: Order) => ({
          ...item,
          full_avatar_path: item.path_avatar
            ? item.path_avatar.startsWith('http')
              ? item.path_avatar
              : this.MEDIA_URL + item.path_avatar
            : 'assets/images/no-avatar.png',
          duration: this.calculateDuration(item.created_at, item.closed_at),
        }));

        this.orders.set(processedData);
        this.playVideo.emit({ data: this.orders });
        this.totalRecords.set(response.total);
      } else {
        this.orders.set([]);
        this.totalRecords.set(0);
      }
    } catch (error) {
      console.error('Lỗi tải đơn hàng:', error);
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Sự kiện khi người dùng gõ vào ô Input
   */
  onGlobalFilter(event: Event) {
    const element = event.target as HTMLInputElement;
    const value = element.value;

    // 1. Cập nhật UI ngay lập tức
    this.searchValue.set(value);

    // 2. Đẩy giá trị vào Subject để xử lý debounce
    this.searchSubject.next(value);
  }

  /**
   * Xóa toàn bộ bộ lọc
   */
  clearFilter() {
    this.activeFilters = {};
    this.searchValue.set('');
    this.searchSubject.next(''); // Reset subject

    if (this.dt) {
      this.dt.reset();
    }
  }

  /**
   * [PUBLIC API] Hàm để Component cha gọi vào khi muốn Filter
   * VD: History Component, Advanced Filter Form
   */
  applyExternalFilter(filters: any) {
    console.log('[OrderList] Applying External Filter:', filters);

    // 1. Merge filter mới
    this.activeFilters = {
      ...this.activeFilters,
      ...filters,
    };

    // 2. Sync UI Input (Nếu filter có chứa code)
    if (filters.hasOwnProperty('code')) {
      if (filters.code) {
        this.searchValue.set(filters.code);
      } else {
        this.searchValue.set('');
        delete this.activeFilters.code;
      }
    }

    // 3. Reset Table để reload dữ liệu
    if (this.dt) {
      this.dt.reset();
    } else {
      // Fallback: Nếu Table chưa init xong (VD: gọi ngay ở ngAfterViewInit cha), gọi load thủ công
      this.loadOrders();
    }
  }

  // --- Utility Functions ---

  calculateDuration(start: string | null | undefined, end: string | null | undefined): string {
    if (!start) return '---';

    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : 0;

    if (isNaN(startTime) || (end && isNaN(endTime))) return '---';
    if (!end) return '---';

    const diffInSeconds = Math.floor((endTime - startTime) / 1000);

    if (diffInSeconds < 0) return '0s';
    if (diffInSeconds < 60) return `${diffInSeconds}s`;

    const mins = Math.floor(diffInSeconds / 60);
    const secs = diffInSeconds % 60;
    return `${mins}p ${secs}s`;
  }

  getSeverity(status: string) {
    switch (status) {
      case 'packed':
        return 'success';
      case 'packing':
        return 'warn';
      case 'cancelled':
        return 'danger';
      default:
        return 'info';
    }
  }
  onPlayvideo(order: any = undefined) {
    let result: any = {
      id: order.id,
      data: this.filterData.data.data.filter((x: any) => x.code == order.code),
    };
    this.playVideo.emit(result);
  }
}

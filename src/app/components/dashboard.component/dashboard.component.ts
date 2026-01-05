import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ImageModule } from 'primeng/image';
import { DatePickerModule } from 'primeng/datepicker';

// App Imports
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { OrderDetailComponent } from '../order-detail.component/order-detail.component';
import { environment } from '../../environments/environment';
import { OrderStatusPipe } from '../../shared/pipes/order-status-pipe';

@Component({
  selector: 'app-dashboard-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    TagModule,
    ToolbarModule,
    ChartModule,
    DialogModule,
    TooltipModule,
    InputTextModule,
    ImageModule,
    DatePickerModule,
    OrderDetailComponent,OrderStatusPipe
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private orderService = inject(OrderService);

  // --- DATA STATE ---
  orders = signal<Order[]>([]);
  loading = signal<boolean>(false);

  // --- KPI STATE ---
  kpiMetrics = signal({
    uniqueOrders: 0,
    totalAttempts: 0,
    efficiencyRatio: 0,
    reworkRate: 0,
    riskCount: 0,
  });

  // --- CHART DATA ---
  reworkChartData: any;
  durationChartData: any;
  chartOptions: any;

  // --- FILTERS STATE ---
  selectedRange: string = 'today';

  // Custom Menu State
  isFilterMenuOpen = false;
  customFromDate: Date | null = null;
  customToDate: Date | null = null;

  // --- MODAL STATE ---
  showDetailDialog = false;
  selectedOrderCode: string | null = null;
  detailHeader = 'Chi Tiết Đơn Hàng';

  ngOnInit() {
    this.initChartOptions();
    this.loadDashboardData('today');
  }

  // --- MENU ACTIONS ---
  toggleFilterMenu() {
    this.isFilterMenuOpen = !this.isFilterMenuOpen;
  }

  closeFilterMenu() {
    this.isFilterMenuOpen = false;
  }

  // --- [QUAN TRỌNG] LOAD DATA ĐÃ SỬA LOGIC ---
  loadDashboardData(range: string) {
    this.selectedRange = range;
    this.loading.set(true);

    // Params cơ bản
    let params: any = { page: 0, pageSize: 1000 };

    // --- XỬ LÝ DATE LOGIC ---
    const now = new Date();

    switch (range) {
        // 1. CÁC MỐC BACKEND HỖ TRỢ SẴN (Gửi date_preset)
        case 'today':
            params.date_preset = 'today';
            break;
        case 'yesterday':
            params.date_preset = 'yesterday';
            break;
        case '15days':
            params.date_preset = 'last15days'; // Mapping '15days' UI -> 'last15days' Backend
            break;

        // 2. CÁC MỐC CẦN TỰ TÍNH TOÁN Ở FRONTEND (Gửi startDate / endDate)
        case 'month': // Tháng này (Từ ngày 1 -> Hiện tại)
            params.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            params.endDate = now;
            break;

        case 'quarter': // Quý này
            const currentQuarter = Math.floor(now.getMonth() / 3);
            params.startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            params.endDate = now;
            break;

        case 'year': // Năm nay
            params.startDate = new Date(now.getFullYear(), 0, 1);
            params.endDate = now;
            break;

        case 'custom': // Tùy chọn
            if (this.customFromDate && this.customToDate) {
                params.startDate = this.customFromDate;
                params.endDate = this.customToDate;
            }
            break;

        default:
            params.date_preset = 'today'; // Mặc định
            break;
    }

    // --- GỌI API ---
    // Lúc này params sẽ có dạng:
    // { date_preset: 'today', ... } HOẶC { startDate: Date, endDate: Date, ... }
    // OrderService sẽ tự động format startDate/endDate thành chuỗi YYYY-MM-DD cho Backend

    this.orderService.getOrders(params).subscribe({
      next: (res) => {
        if (res.data) {
          this.orders.set(res.data);
          this.calculateMetrics(res.data);
          this.prepareCharts(res.data);
        } else {
            this.orders.set([]); // Reset nếu ko có data
            this.calculateMetrics([]);
        }
        this.loading.set(false);
      },
      error: () => {
          this.loading.set(false);
          this.orders.set([]);
      },
    });
  }

  applyCustomDate() {
    if (this.customFromDate && this.customToDate) {
        this.loadDashboardData('custom');
        this.closeFilterMenu();
    }
  }

  // --- LOGIC TÍNH TOÁN KPI ---
  calculateMetrics(data: Order[]) {
    if (!data || data.length === 0) {
        this.kpiMetrics.set({
            uniqueOrders: 0, totalAttempts: 0, efficiencyRatio: 0, reworkRate: 0, riskCount: 0
        });
        return;
    }

    const totalAttempts = data.length;
    const packedOrders = data.filter((o) => (o.status as OrderStatus) === 'PACKED');
    const uniqueCodes = new Set(packedOrders.map((o) => String(o.code))).size;

    const reworkCount = data.filter((o) => {
      const note = o.note || '';
      const parentId = (o as any).parent_id;
      return parentId || note.includes('Làm lại');
    }).length;

    const riskCount = data.filter((o) => {
      return (o.status as OrderStatus) === 'PACKED' && !o.path_video;
    }).length;

    this.kpiMetrics.set({
      uniqueOrders: uniqueCodes,
      totalAttempts: totalAttempts,
      efficiencyRatio: uniqueCodes ? +(totalAttempts / uniqueCodes).toFixed(2) : 0,
      reworkRate: totalAttempts ? +((reworkCount / totalAttempts) * 100).toFixed(1) : 0,
      riskCount: riskCount,
    });
  }

  prepareCharts(data: Order[]) {
    // Reset data nếu rỗng
    if (!data || data.length === 0) {
        this.reworkChartData = { labels: [], datasets: [] };
        this.durationChartData = { labels: [], datasets: [] };
        return;
    }

    const reasons: { [key: string]: number } = {};
    data.forEach((o) => {
      const note = o.note || '';
      if (note && note !== 'string') {
        const reason = note.includes('Auto Timeout') ? 'Auto Timeout' :
                       note.includes('Dừng quay thủ công') ? 'Dừng Thủ Công' :
                       note.includes('Làm lại') ? 'Làm Lại' : 'Khác';
        if (reason !== 'Khác' || note.length > 50) {
          reasons[reason] = (reasons[reason] || 0) + 1;
        }
      }
    });

    this.reworkChartData = {
      labels: Object.keys(reasons),
      datasets: [{
          data: Object.values(reasons),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
        }],
    };

    const durations = data.map((o) => this.calculateDurationSeconds(o.start_at, o.closed_at));
    const buckets = [0, 0, 0, 0];
    durations.forEach((d) => {
      if (d < 30) buckets[0]++;
      else if (d < 60) buckets[1]++;
      else if (d < 120) buckets[2]++;
      else buckets[3]++;
    });

    this.durationChartData = {
      labels: ['< 30s', '30-60s', '1-2 phút', '> 2 phút'],
      datasets: [{
          label: 'Số lượng phiên',
          data: buckets,
          backgroundColor: ['#4ade80', '#60a5fa', '#fbbf24', '#f87171'],
          borderWidth: 0,
          borderRadius: 4,
        }],
    };
  }

  getFullUrl(path?: string): string {
    if (!path || path.trim() === '') {
        return 'assets/no-image.png';
    }
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const relative = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${relative}`;
  }

  openVideoModal(order: Order) {
    this.selectedOrderCode = order.code;
    this.detailHeader = `Kiểm Tra & Playback: ${order.code}`;
    this.showDetailDialog = true;
  }

  calculateDurationSeconds(start?: string | any, end?: string | any): number {
    if (!start || !end) return 0;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e)) return 0;
    return Math.max(0, (e - s) / 1000);
  }

  formatDuration(start?: string, end?: string): string {
    const seconds = this.calculateDurationSeconds(start, end);
    if (seconds === 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }

  getSeverity(status: string | OrderStatus): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | undefined {
    const s = String(status).toUpperCase();
    switch (s) {
      case 'PACKED': return 'success';
      case 'PACKING': return 'info';
      case 'ISSUE': return 'danger';
      case 'MERGED': return 'warn';
      default: return 'secondary';
    }
  }

  initChartOptions() {
    this.chartOptions = {
      plugins: { legend: { position: 'bottom' } },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
        x: { grid: { display: false } },
      },
    };
  }
}

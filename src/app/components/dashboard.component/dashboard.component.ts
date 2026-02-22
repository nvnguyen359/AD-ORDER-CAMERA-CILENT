import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Thêm DatePipe để format nhanh
import { FormsModule } from '@angular/forms';

// ... (Các import cũ giữ nguyên)
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

import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { OrderDetailComponent } from '../order-detail.component/order-detail.component';
import { environment } from '../../environments/environment';
import { OrderStatusPipe } from '../../shared/pipes/order-status-pipe';
import { SystemControlComponent } from '../system-control.component/system-control.component';

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
    OrderDetailComponent, OrderStatusPipe, SystemControlComponent
  ],
  providers: [DatePipe], // Inject DatePipe
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private orderService = inject(OrderService);
  private datePipe = inject(DatePipe); // Dùng để format ngày

  // --- UI STATE ---
  dateLabel = signal<string>(''); // [NEW] Label hiển thị ngày tháng

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

  // --- LOAD DATA ---
  loadDashboardData(range: string) {
    this.selectedRange = range;
    this.loading.set(true);

    let params: any = { page: 0, pageSize: 1000 };
    const now = new Date();
    let label = ''; // Biến tạm để tính label

    switch (range) {
      case 'today':
        params.date_preset = 'today';
        label = `Hôm nay: ${this.datePipe.transform(now, 'dd/MM/yyyy')}`;
        break;

      case 'yesterday':
        params.date_preset = 'yesterday';
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        label = `Hôm qua: ${this.datePipe.transform(yesterday, 'dd/MM/yyyy')}`;
        break;

      case '15days':
        params.date_preset = 'last15days';
        const last15 = new Date(now);
        last15.setDate(now.getDate() - 15);
        label = `${this.datePipe.transform(last15, 'dd/MM')} - ${this.datePipe.transform(now, 'dd/MM/yyyy')}`;
        break;

      case 'month':
        params.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        params.endDate = now;
        label = `Tháng ${this.datePipe.transform(now, 'MM/yyyy')}`;
        break;

      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const qStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        params.startDate = qStart;
        params.endDate = now;
        label = `Quý ${currentQuarter + 1} / ${now.getFullYear()}`;
        break;

      case 'year':
        params.startDate = new Date(now.getFullYear(), 0, 1);
        params.endDate = now;
        label = `Năm ${now.getFullYear()}`;
        break;

      case 'custom':
        if (this.customFromDate && this.customToDate) {
          params.startDate = this.customFromDate;
          params.endDate = this.customToDate;
          label = `${this.datePipe.transform(this.customFromDate, 'dd/MM')} - ${this.datePipe.transform(this.customToDate, 'dd/MM/yyyy')}`;
        }
        break;

      default:
        params.date_preset = 'today';
        label = this.datePipe.transform(now, 'dd/MM/yyyy') || '';
        break;
    }

    // Cập nhật Label ra ngoài giao diện
    this.dateLabel.set(label);

    // Gọi API
    this.orderService.getOrders(params).subscribe({
      next: (res: any) => {
        const items = res.data?.items || [];
        if (items) {
          this.orders.set(items);
          this.calculateMetrics(items);
          this.prepareCharts(items);
        } else {
          this.orders.set([]);
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

  // ... (Giữ nguyên các hàm calculateMetrics, prepareCharts, openVideoModal, v.v...)
  // Phần dưới này không thay đổi so với file gốc của bạn

  calculateMetrics(data: Order[]) {
    // ... logic cũ
    if (!data || data.length === 0) {
        this.kpiMetrics.set({
          uniqueOrders: 0, totalAttempts: 0, efficiencyRatio: 0, reworkRate: 0, riskCount: 0
        });
        return;
      }

      const totalAttempts = data.length;
      const packedOrders = data.filter((o: any) => o.status === 'closed');
      const uniqueCodes = new Set(packedOrders.map((o) => String(o.code))).size;

      const reworkCount = data.filter((o: any) => !!o.parent_id).length;

      const riskCount = data.filter((o: any) => o.status === 'closed' && !o.path_video).length;

      this.kpiMetrics.set({
        uniqueOrders: uniqueCodes,
        totalAttempts: totalAttempts,
        efficiencyRatio: uniqueCodes ? +(totalAttempts / uniqueCodes).toFixed(2) : 0,
        reworkRate: totalAttempts ? +((reworkCount / totalAttempts) * 100).toFixed(1) : 0,
        riskCount: riskCount,
      });
  }

  prepareCharts(data: Order[]) {
      // ... logic cũ
      if (!data || data.length === 0) {
        this.reworkChartData = { labels: [], datasets: [] };
        this.durationChartData = { labels: [], datasets: [] };
        return;
      }

      const reasons: { [key: string]: number } = {};
      data.forEach((o: any) => {
        const note = o.note || '';
        let reason = 'Khác';
        if (o.parent_id) { reason = 'Làm Lại'; }
        else if (note.includes('Timeout')) { reason = 'Auto Timeout'; }
        else if (note.includes('Manual') || note.includes('Dừng thủ công')) { reason = 'Dừng Thủ Công'; }
        else if (note.includes('Checking Only')) { reason = 'Checking Only'; }

        if (reason !== 'Khác' || note.length > 5) {
          reasons[reason] = (reasons[reason] || 0) + 1;
        }
      });

      this.reworkChartData = {
        labels: Object.keys(reasons),
        datasets: [{
          data: Object.values(reasons),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
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

  // ... (Các hàm helper getFullUrl, formatDuration... giữ nguyên)
  getFullUrl(path?: string): string {
    if (!path || path.trim() === '') return 'assets/no-image.png';
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
    const s = String(status).toLowerCase();
    switch (s) {
      case 'closed': return 'success';
      case 'cancelled': return 'danger';
      case 'packed': return 'success';
      case 'merging': return 'warn';
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

import { Component, EventEmitter, Output, inject, signal, computed, ViewEncapsulation, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ToolbarModule } from 'primeng/toolbar';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { MenuModule } from 'primeng/menu';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { DialogModule } from 'primeng/dialog';
import { MenuItem } from 'primeng/api';

import { OrderService } from '../../core/services/order.service';
import { Order } from '../../core/models/order.model';
import { environment } from '../../environments/environment';
import { QrScanDialogComponent } from '../qr-scan-dialog.component/qr-scan-dialog.component';
import { OrderDetailComponent } from '../order-detail.component/order-detail.component';

export interface FilterState {
  code?: string;
  status?: string;
  date_preset?: string;
  start_date?: Date;
  end_date?: Date;
}

@Component({
  selector: 'app-order-search',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ToolbarModule, InputGroupModule, InputGroupAddonModule,
    AutoCompleteModule, ButtonModule, DatePickerModule, MenuModule, ChipModule,
    TooltipModule, BadgeModule, DialogModule, QrScanDialogComponent, OrderDetailComponent,
  ],
  templateUrl: './order-search.component.html',
  styleUrls: ['./order-search.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class OrderSearchComponent {
  private orderService = inject(OrderService);
  private sanitizer = inject(DomSanitizer);

  @Output() filterChange = new EventEmitter<FilterState>();
  @Output() openQrScanner = new EventEmitter<void>();
  isShowFilter = input<boolean>(true);

  // [QUAN TRỌNG] Nhận tổng số đơn từ component Cha (History)
  badgeValue = input<number>(0);
  showDateDialog = false;
  // --- SIGNALS ---
  suggestions = signal<Order[]>([]);
  activePreset = signal<string>('today');
  searchKeyword = signal<string>('');

  // State Badge tìm kiếm
  totalOrders = signal<number>(0);

  showQrDialog = false;
  showDetailDialog = false;
  foundOrderCode: string | null = null;
  selectedCode: string | null = null;
  rangeDates: Date[] | undefined;

  readonly presets = [
    { label: 'Hôm nay', value: 'today' },
    { label: 'Hôm qua', value: 'yesterday' },
    { label: '7 ngày qua', value: 'last7days' },
    { label: '15 ngày qua', value: 'last15days' },
  ];

menuItems = computed<MenuItem[]>(() => {
    const active = this.activePreset();
    return [
      ...this.presets.map((p) => ({
        label: p.label,
        icon: active === p.value ? 'pi pi-check text-primary' : 'pi pi-calendar',
        command: () => this.selectPreset(p.value),
      })),
      { separator: true },
      // [CẬP NHẬT] Bỏ disabled và thêm command mở dialog
      { 
        label: 'Tùy chọn ngày', 
        icon: active === 'custom' ? 'pi pi-check text-primary' : 'pi pi-calendar-plus',
        command: () => {
          this.showDateDialog = true;
        }
      },
    ];
  });

  constructor() {
    setTimeout(() => this.emitCurrentState(), 0);
  }

  // --- LOGIC SEARCH & HIGHLIGHT ---
  removeAccents(str: string): string {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  highlightText(text: string | undefined): SafeHtml {
    if (!text) return '';
    const query = this.searchKeyword().trim();
    if (!query) return text;
    const pattern = new RegExp(`(${query})`, 'gi');
    return this.sanitizer.bypassSecurityTrustHtml(text.replace(pattern, '<span class="highlight-match">$1</span>'));
  }

  searchOrders(event: AutoCompleteCompleteEvent) {
    const query = event.query;
    this.searchKeyword.set(query);
    const normalizedQuery = this.removeAccents(query);
    this.orderService.getOrders({ page: 0, pageSize: 50, code: query }).subscribe({
        next: (res: any) => {
            const responseData: any = res.data || {};
            let rawData: Order[] = [];
            if (Array.isArray(responseData)) { rawData = responseData; }
            else if (responseData.items && Array.isArray(responseData.items)) { rawData = responseData.items; }
            let uniqueOrders = Array.from(new Map(rawData.map((item) => [item.code, item])).values());
            if (normalizedQuery) {
                uniqueOrders = uniqueOrders.filter((order) => {
                    const normalizedCode = this.removeAccents(order.code);
                    const normalizedPacker = this.removeAccents(order.packer_name || '');
                    return normalizedCode.includes(normalizedQuery) || normalizedPacker.includes(normalizedQuery);
                });
            }
            this.suggestions.set(uniqueOrders.slice(0, 10));
        },
        error: () => this.suggestions.set([]),
    });
  }

  onOrderSelect(event: AutoCompleteSelectEvent) {
    const selectedItem = event.value as Order;
    this.selectedCode = selectedItem.code;
    this.handleSelect(this.selectedCode);
    this.calculateTotalOrders(this.selectedCode);
  }

  handleSelect(code: string) {
    this.emitWithOverride({ code: code });
  }

  onClearSearch() {
    this.selectedCode = null;
    this.searchKeyword.set('');
    this.totalOrders.set(0);
    this.emitWithOverride({ code: undefined });
  }

  // Tính tổng đơn tìm kiếm (Gốc + Repack)
  calculateTotalOrders(code: string) {
    if (!code) return;
    this.orderService.getOrders({ code: code, page: 0, pageSize: 100 }).subscribe({
      next: (res: any) => {
        const responseData = res.data || {};

        let items: any[] = [];
        if (Array.isArray(responseData)) { items = responseData; }
        else if (responseData.items && Array.isArray(responseData.items)) { items = responseData.items; }

        if (items.length > 0) {
            let count = 0;
            items.forEach(item => {
                count++;
                if (item.history_logs && Array.isArray(item.history_logs)) { count += item.history_logs.length; }
            });
            this.totalOrders.set(count);

            this.foundOrderCode = code;
        } else { this.totalOrders.set(0); }
      },
      error: () => this.totalOrders.set(0)
    });
  }

  selectPreset(value: string) {
    this.activePreset.set(value);
    this.rangeDates = undefined;
    this.emitCurrentState();
  }

  onCustomDateSelect() {
    if (this.rangeDates && this.rangeDates.length > 0) {
      this.activePreset.set('custom');
      this.emitCurrentState();
    }
  }

  getFullUrl(path?: string): string {
    if (!path) return '';
    const baseUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const relativePath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${relativePath}`;
  }

  private emitCurrentState() {
    const code = this.selectedCode || undefined;
    const preset = this.activePreset();
    let dateParams: any = { date_preset: preset };
    if (preset === 'custom' && this.rangeDates) {
      dateParams = { date_preset: undefined, start_date: this.rangeDates[0], end_date: this.rangeDates[1] || this.rangeDates[0] };
    }
    this.filterChange.emit({ code, ...dateParams });
  }

  private emitWithOverride(override: Partial<FilterState>) {
    const preset = this.activePreset();
    let dateParams: any = { date_preset: preset };
    if (preset === 'custom' && this.rangeDates) {
      dateParams = { date_preset: undefined, start_date: this.rangeDates[0], end_date: this.rangeDates[1] || this.rangeDates[0] };
    }
    this.filterChange.emit({ ...dateParams, ...override });
  }

  onQrScanSuccess(code: string) {
    this.selectedCode = code;
    this.handleSelect(code);
    this.calculateTotalOrders(code);
    this.showQrDialog = false;
  }
}

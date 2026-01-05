import {
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
  computed,
  ViewEncapsulation,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// PrimeNG Imports
import { ToolbarModule } from 'primeng/toolbar';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import {
  AutoCompleteModule,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { MenuModule } from 'primeng/menu';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';
import { MenuItem } from 'primeng/api';

// App Imports
import { OrderService } from '../../core/services/order.service';
import { Order } from '../../core/models/order.model';
import { environment } from '../../environments/environment';
import { QrScanDialogComponent } from '../qr-scan-dialog.component/qr-scan-dialog.component';

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
    CommonModule,
    FormsModule,
    ToolbarModule,
    InputGroupModule,
    InputGroupAddonModule,
    AutoCompleteModule,
    ButtonModule,
    DatePickerModule,
    MenuModule,
    ChipModule,
    TooltipModule,
    QrScanDialogComponent,
  ],
  templateUrl: './order-search.component.html',
  styleUrls: ['./order-search.component.scss'],
  encapsulation: ViewEncapsulation.None, // Quan trọng: Để CSS highlight apply được vào innerHTML
})
export class OrderSearchComponent {
  private orderService = inject(OrderService);
  private sanitizer = inject(DomSanitizer);

  // --- OUTPUTS ---
  @Output() filterChange = new EventEmitter<FilterState>();
  @Output() openQrScanner = new EventEmitter<void>();
  isShowFilter = input<boolean>(true);
  // --- SIGNALS & STATE ---
  suggestions = signal<Order[]>([]);
  activePreset = signal<string>('today');
  // State điều khiển hiển thị Dialog
  showQrDialog = false;
  // Lưu từ khóa để highlight
  searchKeyword = signal<string>('');

  // Models
  selectedCode: string | null = null;
  rangeDates: Date[] | undefined;

  // Configuration
  readonly presets = [
    { label: 'Hôm nay', value: 'today' },
    { label: 'Hôm qua', value: 'yesterday' },
    { label: '7 ngày qua', value: 'last7days' },
    { label: '15 ngày qua', value: 'last15days' },
  ];

  // --- COMPUTED MENU (MOBILE) ---
  menuItems = computed<MenuItem[]>(() => {
    const active = this.activePreset();
    return [
      ...this.presets.map((p) => ({
        label: p.label,
        icon: active === p.value ? 'pi pi-check text-primary' : 'pi pi-calendar',
        command: () => this.selectPreset(p.value),
      })),
      { separator: true },
      {
        label: 'Tùy chọn ngày',
        icon: active === 'custom' ? 'pi pi-check text-primary' : 'pi pi-calendar-plus',
        disabled: true,
      },
    ];
  });

  constructor() {
    setTimeout(() => this.emitCurrentState(), 0);
  }

  // ==========================================
  // 1. LOGIC TÌM KIẾM (DEDUPLICATE + ACCENT + HIGHLIGHT)
  // ==========================================

  // Hàm chuyển tiếng Việt có dấu -> không dấu
  removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  // Hàm tạo HTML highlight từ khóa
  highlightText(text: string | undefined): SafeHtml {
    if (!text) return '';
    const query = this.searchKeyword().trim();

    // Nếu không có từ khóa hoặc từ khóa rỗng, trả về text gốc (đã sanitize nhẹ)
    if (!query) return text;

    // Tìm kiếm tương đối (không cần regex quá phức tạp vì ta đã filter rồi)
    // Tuy nhiên để highlight đúng ký tự gốc (có dấu) dựa trên input (không dấu) là rất khó
    // Ở đây ta dùng cách đơn giản: Highlight chuỗi khớp Case-Insensitive
    const pattern = new RegExp(`(${query})`, 'gi');
    const highlighted = text.replace(pattern, '<span class="highlight-match">$1</span>');

    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  searchOrders(event: AutoCompleteCompleteEvent) {
    const query = event.query;
    this.searchKeyword.set(query); // Lưu keyword highlight

    const normalizedQuery = this.removeAccents(query);

    this.orderService
      .getOrders({
        page: 0,
        pageSize: 50, // Lấy rộng ra để lọc client-side
        code: query,
      })
      .subscribe({
        next: (res) => {
          const rawData = res.data || [];

          // B1: Lọc trùng mã (Deduplicate)
          let uniqueOrders = Array.from(new Map(rawData.map((item) => [item.code, item])).values());

          // B2: Lọc Tiếng Việt không dấu (Client-side)
          if (normalizedQuery) {
            uniqueOrders = uniqueOrders.filter((order) => {
              const normalizedCode = this.removeAccents(order.code);
              const normalizedPacker = this.removeAccents(order.packer_name || '');

              return (
                normalizedCode.includes(normalizedQuery) ||
                normalizedPacker.includes(normalizedQuery)
              );
            });
          }

          // Cắt lấy 10 kết quả hiển thị
          this.suggestions.set(uniqueOrders.slice(0, 10));
        },
        error: () => this.suggestions.set([]),
      });
  }

  // ==========================================
  // 2. LOGIC CHỌN & XỬ LÝ
  // ==========================================
  onOrderSelect(event: AutoCompleteSelectEvent) {
    const selectedItem = event.value as Order;
    // Ép kiểu về String cho Model
    this.selectedCode = selectedItem.code;

    // Xử lý logic
    this.handleSelect(this.selectedCode);
  }

  handleSelect(code: string) {
    console.log('Selected:', code);
    this.emitWithOverride({ code: code });
  }

  onClearSearch() {
    this.selectedCode = null;
    this.searchKeyword.set('');
    this.emitWithOverride({ code: undefined });
  }

  // ==========================================
  // 3. LOGIC DATE FILTER
  // ==========================================
  selectPreset(value: string) {
    console.log(value);
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

  // ==========================================
  // 4. HELPERS
  // ==========================================
  getFullUrl(path?: string): string {
    if (!path) return '';
    const baseUrl = environment.apiUrl.endsWith('/')
      ? environment.apiUrl.slice(0, -1)
      : environment.apiUrl;
    const relativePath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${relativePath}`;
  }

  private emitCurrentState() {
    const code = this.selectedCode || undefined;
    const preset = this.activePreset();
    let dateParams: any = { date_preset: preset };

    if (preset === 'custom' && this.rangeDates) {
      dateParams = {
        date_preset: undefined,
        start_date: this.rangeDates[0],
        end_date: this.rangeDates[1] || this.rangeDates[0],
      };
    }
    this.filterChange.emit({ code, ...dateParams });
  }

  private emitWithOverride(override: Partial<FilterState>) {
    const preset = this.activePreset();
    let dateParams: any = { datePreset: preset };
    if (preset === 'custom' && this.rangeDates) {
      dateParams = {
        date_preset: undefined,
        start_date: this.rangeDates[0],
        end_date: this.rangeDates[1] || this.rangeDates[0],
      };
    }
    this.filterChange.emit({ ...dateParams, ...override });
  }
  // Hàm xử lý khi quét thành công
  onQrScanSuccess(code: string) {
    console.log('Quét thành công:', code);

    // 1. Điền vào ô input
    this.selectedCode = code;

    // 2. Gọi hàm handleSelect để tìm kiếm ngay
    this.handleSelect(code);

    // Dialog tự đóng do logic bên trong QrScanDialogComponent
    // hoặc bạn set this.showQrDialog = false ở đây cho chắc chắn.
  }
}

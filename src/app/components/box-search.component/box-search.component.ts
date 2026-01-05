import { Component, EventEmitter, Output, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// PrimeNG Imports
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import {
  AutoCompleteModule,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog'; // [MỚI]
import { ToastModule } from 'primeng/toast'; // [MỚI]
import { MessageService } from 'primeng/api'; // [MỚI]

// App Imports
import { OrderService } from '../../core/services/order.service';
import { Order } from '../../core/models/order.model';
import { environment } from '../../environments/environment';
import { QrScanDialogComponent } from '../qr-scan-dialog.component/qr-scan-dialog.component';
import { OrderDetailComponent } from '../order-detail.component/order-detail.component';

export interface BoxSearchFilter {
  code?: string;
}

@Component({
  selector: 'app-box-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputGroupModule,
    InputGroupAddonModule,
    AutoCompleteModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    ToastModule, // [MỚI]
    QrScanDialogComponent,
    OrderDetailComponent, // [MỚI]
  ],
  providers: [MessageService], // Provider cục bộ để toast hiện ở đây (hoặc dùng root)
  templateUrl: './box-search.component.html',
  styleUrls: ['./box-search.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class BoxSearchComponent {
  private orderService = inject(OrderService);
  private sanitizer = inject(DomSanitizer);
  private messageService = inject(MessageService); // [MỚI]

  @Output() filterChange = new EventEmitter<BoxSearchFilter>();

  // State Search
  suggestions = signal<Order[]>([]);
  searchKeyword = signal<string>('');
  selectedCode: string | null = null;

  // State Dialogs
  showQrDialog = false;
  showDetailDialog = false; // [MỚI] Biến bật tắt Dialog Detail
  foundOrderCode: string | null = null; // [MỚI] Mã tìm được để truyền vào Dialog
  header = 'Kiểm Tra Đơn Hàng ';
  // --- 1. TÌM KIẾM AUTOCOMPLETE (Giữ nguyên) ---
  searchOrders(event: AutoCompleteCompleteEvent) {
    const query = event.query;
    this.searchKeyword.set(query);

    this.orderService.getOrders({ page: 0, pageSize: 50, code: query }).subscribe({
      next: (res) => {
        const rawData = res.data || [];
        const uniqueMap = new Map();
        rawData.forEach((item: any) => {
          const cleanCode = item.code ? String(item.code).trim() : '';
          if (cleanCode && !uniqueMap.has(cleanCode)) {
            uniqueMap.set(cleanCode, item);
          }
        });
        this.suggestions.set(Array.from(uniqueMap.values()) as Order[]);
      },
      error: () => this.suggestions.set([]),
    });
  }

  highlightText(text: string | undefined): SafeHtml {
    if (!text) return '';
    const query = this.searchKeyword().trim();
    if (!query) return text;
    const pattern = new RegExp(`(${query})`, 'gi');
    return this.sanitizer.bypassSecurityTrustHtml(
      text.replace(pattern, '<span class="highlight-match">$1</span>')
    );
  }

  onClearSearch() {
    this.selectedCode = null;
    this.searchKeyword.set('');
    this.emitFilter(undefined);
  }

  private emitFilter(code: string | undefined) {
    this.filterChange.emit({ code: code });
  }

  getFullUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.endsWith('/')
      ? environment.apiUrl.slice(0, -1)
      : environment.apiUrl;
    const relative = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${relative}`;
  }

  // --- 2. LOGIC MỚI: CHECK DB & MỞ DIALOG ---

  // Khi chọn từ Dropdown gợi ý
  onOrderSelect(event: AutoCompleteSelectEvent) {
    const order = event.value;
    this.selectedCode = order.code;
    this.header = `Kiểm Tra Đơn Hàng ${order.code}`;
    this.checkAndOpenOrder(order.code); // Gọi check
  }

  // Khi quét QR thành công
  onQrScanSuccess(code: string) {
    this.showQrDialog = false; // Tắt camera
    this.selectedCode = code;
    this.header = `Kiểm Tra Đơn Hàng ${this.selectedCode}`;
    this.searchKeyword.set(code);
    this.checkAndOpenOrder(code); // Gọi check ngay
  }

  // Hàm Check DB trung tâm
  checkAndOpenOrder(code: string) {
    if (!code) return;
    this.header = `Kiểm Tra Đơn Hàng ${code}`;
    // Gọi API check xem có dữ liệu không
    this.orderService.getOrders({ code: code, page: 0, pageSize: 1 }).subscribe({
      next: (res) => {
        // Logic check: API trả về 200 VÀ có data
        const hasData =
          res.code === 200 &&
          res.data &&
          (Array.isArray(res.data) ? res.data.length > 0 : !!res.data);

        if (hasData) {
          // [CASE 1] CÓ -> MỞ DIALOG
          this.foundOrderCode = code;
          this.showDetailDialog = true;
          this.playSound('success'); // Ting!
        } else {
          // [CASE 2] KHÔNG -> BÁO LỖI
          this.showError(code);
        }
      },
      error: () => {
        this.showError(code); // Lỗi mạng cũng báo lỗi
      },
    });
  }

  showError(code: string) {
    this.playSound('error'); // Bíp Bíp!
    this.messageService.add({
      severity: 'error',
      summary: 'Không tìm thấy!',
      detail: `Không có dữ liệu đóng gói cho mã: ${code}`,
      life: 4000,
    });
  }

  playSound(type: 'success' | 'error') {
    // Đảm bảo bạn có file mp3 trong assets/sounds/
    const file = type === 'success' ? 'assets/sounds/success.mp3' : 'assets/sounds/error.mp3';
    const audio = new Audio(file);
    audio.play().catch(() => {}); // Bỏ qua lỗi auto-play policy
  }
}

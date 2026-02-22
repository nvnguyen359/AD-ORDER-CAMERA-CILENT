import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseService } from './base.service';
import { Order, OrderResponse } from '../models/order.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OrderService extends BaseService<Order> {
  protected override endpoint = 'orders';

  constructor() {
    super();
  }

  /**
   * Lấy danh sách đơn hàng có xử lý bộ lọc, phân trang, sắp xếp
   * @param params Params từ component (PrimeNG Table LazyLoadEvent)
   */
  getOrders(params: any): Observable<OrderResponse> {
    // 1. Clone params để xử lý, tránh ảnh hưởng object gốc bên component
    const queryParams: any = { ...params };

    // --- A. XỬ LÝ NGÀY THÁNG (RANGE) ---
    // Backend cần: YYYY-MM-DD HH:mm:ss

    // 1. Xử lý Start Date
    if (queryParams.startDate) {
      queryParams.start_date = this.formatDateForBackend(queryParams.startDate, false);
      delete queryParams.startDate;
    } else if (queryParams.start_date && queryParams.start_date instanceof Date) {
      queryParams.start_date = this.formatDateForBackend(queryParams.start_date, false);
    }

    // 2. Xử lý End Date (Ép về 23:59:59)
    if (queryParams.endDate) {
      queryParams.end_date = this.formatDateForBackend(queryParams.endDate, true);
      delete queryParams.endDate;
    } else if (queryParams.end_date && queryParams.end_date instanceof Date) {
      queryParams.end_date = this.formatDateForBackend(queryParams.end_date, true);
    }

    // --- B. XỬ LÝ FILTER NÂNG CAO (THÁNG, QUÝ, NĂM, EXACT MATCH) ---
    // Đảm bảo dữ liệu gửi lên là số (number)
    if (queryParams.month) {
      queryParams.month = Number(queryParams.month);
    }
    if (queryParams.quarter) {
      queryParams.quarter = Number(queryParams.quarter);
    }
    if (queryParams.year) {
      queryParams.year = Number(queryParams.year);
    }
    // Chế độ tìm kiếm chính xác (dùng cho QR Scan)
    if (queryParams.exact_match !== undefined) {
      queryParams.exact_match = queryParams.exact_match;
    }

    // --- C. XỬ LÝ PHÂN TRANG & SORT ---

    // Map 'rows' -> 'page_size'
    const pageSize = queryParams.rows || queryParams.pageSize || 10;
    queryParams.page_size = pageSize;

    // Map 'first' -> 'page' (Backend thường bắt đầu từ 0)
    if (queryParams.first !== undefined) {
      queryParams.page = Math.floor(queryParams.first / pageSize);
    }

    // Map 'sortField' -> 'sort_by'
    if (queryParams.sortField) {
      queryParams.sort_by = queryParams.sortField;
    }

    // Map 'sortOrder' -> 'sort_dir'
    if (queryParams.sortOrder) {
      queryParams.sort_dir = queryParams.sortOrder === 1 ? 'asc' : 'desc';
    }

    // [BỔ SUNG] Mặc định sắp xếp giảm dần theo ngày tạo nếu UI không gửi sort lên
    if (!queryParams.sort_by) {
      queryParams.sort_by = 'created_at';
      queryParams.sort_dir = 'desc';
    }

    // --- D. CLEANUP (XÓA DỮ LIỆU RÁC CỦA PRIMENG) ---
    const keysToRemove = [
      'rows',
      'pageSize',
      'first',
      'sortField',
      'sortOrder',
      'filters',
      'globalFilter',
      'multiSortMeta',
      'forceUpdate',
    ];

    keysToRemove.forEach((key) => delete queryParams[key]);

    // Xóa các giá trị null/undefined/rỗng (trừ số 0)
    Object.keys(queryParams).forEach((key) => {
      const val = queryParams[key];
      if (val === null || val === undefined || val === '') {
        delete queryParams[key];
      }
    });

    return this.findAll(queryParams) as Observable<OrderResponse>;
  }

  /**
   * Helper: Chuyển Date Object sang chuỗi YYYY-MM-DD HH:mm:ss
   * @param date - Ngày cần format
   * @param isEndOfDay - Nếu true, sẽ set giờ thành 23:59:59
   */
  private formatDateForBackend(date: Date | string, isEndOfDay: boolean = false): string {
    if (!date) return '';
    const d = new Date(date);

    if (isNaN(d.getTime())) return String(date);

    // Nếu là End Date, ép thời gian về cuối ngày
    if (isEndOfDay) {
      d.setHours(23, 59, 59, 999);
    }

    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    const hours = ('0' + d.getHours()).slice(-2);
    const minutes = ('0' + d.getMinutes()).slice(-2);
    const seconds = ('0' + d.getSeconds()).slice(-2);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // Xóa 1 đơn hàng
  deleteOrder(id: number): Observable<any> {
    return this.delete(id);
  }

  // Xóa tất cả đơn hàng
  deleteAllOrders(): Observable<any> {
    return this.http.delete(this.apiUrl);
  }

  // Lấy danh sách gia đình đơn hàng (Cha - Con - Chính nó)
  getOrderFamily(code: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/family`, { params: { code } });
  }
}

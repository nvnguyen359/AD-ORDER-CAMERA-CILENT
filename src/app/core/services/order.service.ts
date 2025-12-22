// core/services/order.service.ts
import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { Order, OrderResponse } from '../models/order.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderService extends BaseService<Order> {
  protected endpoint = 'orders';

  /**
   * Gọi API lấy danh sách Order
   * Tự động map tham số camelCase (Frontend) sang snake_case (Backend)
   */
  getOrders(params: {
    page?: number;      // Backend: page
    pageSize?: number;  // Backend: page_size
    code?: string;
    status?: string;
    date_preset?: 'today' | 'yesterday' | 'last7days' | 'last15days';
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    [key: string]: any;
  }): Observable<OrderResponse> {

    // Chuẩn bị params để gửi đi
    const queryParams: any = { ...params };

    // 1. Map pageSize -> page_size cho khớp FastAPI
    if (queryParams.pageSize) {
      queryParams.page_size = queryParams.pageSize;
      delete queryParams.pageSize;
    }

    // 2. Map sortField -> sort_by (nếu bạn dùng PrimeNG lazy load thường trả về sortField)
    if (queryParams.sortField) {
      queryParams.sort_by = queryParams.sortField;
      delete queryParams.sortField;
    }

    // 3. Map sortOrder -> sort_dir (PrimeNG trả về 1/-1, Backend cần asc/desc)
    if (queryParams.sortOrder) {
      queryParams.sort_dir = queryParams.sortOrder === 1 ? 'asc' : 'desc';
      delete queryParams.sortOrder;
    }

    return this.findAll(queryParams);
  }

  /**
   * Xóa 1 Order
   * API: DELETE /orders/{id}
   */
  deleteOrder(id: number): Observable<any> {
    return this.delete(id);
  }

  /**
   * Xóa TẤT CẢ Order
   * API: DELETE /orders/delete-all
   */
  deleteAllOrders(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete-all`);
  }
}

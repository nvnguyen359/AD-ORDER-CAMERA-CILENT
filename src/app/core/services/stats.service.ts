import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// 1. Định nghĩa Interface đúng với cấu trúc Backend trả về (order_router.py)
interface OrderItem {
  status: string;
  [key: string]: any; // Cho phép các trường khác
}

interface PaginatedData {
  items: OrderItem[];
  total: number;
  page: number;
  limit: number;
}

interface ApiResponse {
  code: number;
  message?: string;
  data: PaginatedData; // Data chứa items và total
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/orders`;

  // Lấy thống kê tổng quan (1 Request duy nhất)
  getDailyStats(): Observable<{ completed: number; packing: number }> {
    return this.http.get<ApiResponse>(this.apiUrl, {
      params: {
        date_preset: 'today',
        limit: 1000 // [FIX] Backend dùng 'limit', không phải 'page_size'
      }
    }).pipe(
      map((res) => {
        // [FIX QUAN TRỌNG] Truy cập vào .items thay vì .data trực tiếp
        // Vì backend trả về: { data: { items: [], total: ... } }
        const orders = res.data?.items || [];

        // Xử lý đếm status
        // Lưu ý: Backend đang set 'processing' khi start và 'closed' khi đóng
        // Bạn hãy chắc chắn tên status khớp với DB (ví dụ: 'packing' hay 'processing')
        const completedCount = orders.filter(o => o.status === 'packed' || o.status === 'closed').length;

        // Đếm các đơn đang xử lý (bao gồm cả trạng thái processing từ backend)
        const packingCount = orders.filter(o => o.status === 'packing' || o.status === 'processing').length;

        return {
          completed: completedCount,
          packing: packingCount
        };
      })
    );
  }
}

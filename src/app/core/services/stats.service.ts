import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';


// Interface trả về từ API response_success
interface ApiResponse {
  code: number;
  data: any[];
  total: number; // <--- Chúng ta cần số này
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/orders`;

  // Lấy thống kê tổng quan (Gọi song song 2 requests)
  getDailyStats(): Observable<{ completed: number; packing: number }> {
    return forkJoin({
      // 1. Đơn đã xong hôm nay (status='packed', date_preset='today')
      // Tham chiếu EnumOrderStatus.PACKED
      completed: this.http.get<ApiResponse>(this.apiUrl, {
        params: {
          status: 'packed',
          date_preset: 'today',
          page_size: 1
        }
      }),

      // 2. Đơn đang đóng (status='packing', toàn thời gian)
      // Tham chiếu EnumOrderStatus.PACKING
      packing: this.http.get<ApiResponse>(this.apiUrl, {
        params: {
          status: 'packing',
          page_size: 1
        }
      })
    }).pipe(
      map(results => ({
        completed: results.completed.total || 0,
        packing: results.packing.total || 0
      }))
    );
  }
}

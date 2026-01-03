import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Interface trả về từ API response_success
interface ApiResponse {
  code: number;
  data: any[];
  total: number;
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
        page_size: 1000 // [Quan trọng] Lấy số lượng lớn để đếm chính xác toàn bộ đơn trong ngày
      }
    }).pipe(
      map((res) => {
        const orders = res.data || [];
        // Xử lý status tại Client (Frontend)
        const completedCount = orders.filter(o => o.status === 'packed' || o.status === 'closed').length;
        const packingCount = orders.filter(o => o.status === 'packing').length;

        return {
          completed: completedCount,
          packing: packingCount
        };
      })
    );
  }
}

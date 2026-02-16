// app/core/services/camera.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs'; // [QUAN TRỌNG] Import 'of' để tạo Fake Response

import { MonitorCamera } from '../models/monitor-camera.model';
import { environment } from '../../environments/environment';

export interface ApiResponse<T> {
  code: number;
  mes: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  // Đường dẫn API (Khớp với prefix trong camera_router.py)
  private apiUrl = `${environment.apiUrl}/cameras`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy danh sách tất cả camera
   */
  getAllCameras(all = true): Observable<ApiResponse<MonitorCamera[]>> {
    return this.http.get<ApiResponse<MonitorCamera[]>>(`${this.apiUrl}`, {
      params: new HttpParams().set('skip', 0).set('limit', 100).set('all', all),
    });
  }

  /**
   * Lấy chi tiết 1 camera (Theo ID)
   */
  getCameraById(id: number): Observable<ApiResponse<MonitorCamera>> {
    return this.http.get<ApiResponse<MonitorCamera>>(`${this.apiUrl}/${id}`);
  }

  // Hàm alias (giữ lại để tương thích code cũ nếu có)
  getCamera(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Cập nhật thông tin camera (Ví dụ: Đổi tên hiển thị)
   * API: PATCH /cameras/{id}
   */
  updateCamera(id: number, data: Partial<MonitorCamera>): Observable<ApiResponse<MonitorCamera>> {
    return this.http.patch<ApiResponse<MonitorCamera>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Kết nối lại Camera
   * API: POST /cameras/{id}/connect
   */
  connectCamera(id: number): Observable<ApiResponse<MonitorCamera>> {
    return this.http.post<ApiResponse<MonitorCamera>>(`${this.apiUrl}/${id}/connect`, {});
  }

  /**
   * [LOGIC MỚI - CHỈ ADMIN MỚI KILL ĐƯỢC]
   * Ngắt kết nối Camera.
   * * @param id ID của Camera
   * @param force
   * - Nếu true: Gọi API thật để Server KILL process (Dùng ở trang Setting).
   * - Nếu false (Mặc định): Chỉ trả về success giả để UI hủy widget mà không làm chết cam (Dùng ở Monitor).
   */
  disconnectCamera(id: number, force: boolean = true): Observable<ApiResponse<any>> {
    if (force) {
      // [CASE 1] Admin thao tác ở Setting -> Gửi lệnh Kill thật
      return this.http.post<ApiResponse<any>>(`${this.apiUrl}/${id}/disconnect`, {});
    } else {
      // [CASE 2] Monitor chuyển cam / hủy widget -> Fake Success
      // Giúp luồng Camera ở Backend vẫn sống, không bị gián đoạn ghi hình
      console.log(`[Client] Disconnect Cam ${id} (UI Only - Process Kept Alive)`);
      return of({
        code: 200,
        mes: 'Disconnected UI Only',
        data: {},
      });
    }
  }

  /**
   * API lấy dữ liệu AI Overlay (Polling)
   * Thêm header 'X-Skip-Loading' để interceptor không hiện spinner làm phiền
   */
  getAIOverlay(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/ai-overlay`, {
      headers: new HttpHeaders({ 'X-Skip-Loading': 'true' }),
    });
  }
}

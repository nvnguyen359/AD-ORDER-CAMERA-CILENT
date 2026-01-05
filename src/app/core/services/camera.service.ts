import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http'; // [FIX] Import HttpHeaders
import { Observable } from 'rxjs';

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
  getAllCameras(): Observable<ApiResponse<MonitorCamera[]>> {
    return this.http.get<ApiResponse<MonitorCamera[]>>(`${this.apiUrl}`, {
      params: new HttpParams().set('skip', 0).set('limit', 100),
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
   * Ngắt kết nối Camera
   * API: POST /cameras/{id}/disconnect
   */
  disconnectCamera(id: number): Observable<ApiResponse<MonitorCamera>> {
    return this.http.post<ApiResponse<MonitorCamera>>(`${this.apiUrl}/${id}/disconnect`, {});
  }

  /**
   * [FIX QUAN TRỌNG] API lấy dữ liệu AI Overlay (Polling)
   * Thêm header 'X-Skip-Loading' để Interceptor không hiện màn hình chờ (Loading Spinner)
   */
  getAIOverlay(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/ai-overlay`, {
      headers: new HttpHeaders({
        'X-Skip-Loading': 'true', // <--- Header này sẽ chặn Loading Global
      }),
    });
  }
  
}

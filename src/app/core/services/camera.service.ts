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
  providedIn: 'root'
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
      params: new HttpParams().set('skip', 0).set('limit', 100)
    });
  }

  /**
   * Lấy chi tiết 1 camera
   */
  getCameraById(id: number): Observable<ApiResponse<MonitorCamera>> {
    return this.http.get<ApiResponse<MonitorCamera>>(`${this.apiUrl}/${id}`);
  }

  /**
   * [FIX QUAN TRỌNG] API lấy dữ liệu AI Overlay (Polling)
   * Thêm header 'X-Skip-Loading' để Interceptor không hiện màn hình chờ
   */
  getAIOverlay(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/ai-overlay`, {
      headers: new HttpHeaders({
        'X-Skip-Loading': 'true' // <--- Header này sẽ chặn Loading Global
      })
    });
  }
}

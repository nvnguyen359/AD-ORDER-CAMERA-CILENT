import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { MonitorCamera } from '../models/monitor-camera.model';
import { environment } from '../../environments/environment';

// Định nghĩa Interface trả về từ Server (Response Wrapper)
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
   * API: GET /cameras
   */
  getAllCameras(): Observable<ApiResponse<MonitorCamera[]>> {
    return this.http.get<ApiResponse<MonitorCamera[]>>(`${this.apiUrl}`, {
      params: new HttpParams()
        .set('skip', 0)
        .set('limit', 100) // Lấy tối đa 100 cam
    });
  }

  /**
   * Lấy chi tiết 1 camera
   * API: GET /cameras/{id}
   */
  getCameraById(id: number): Observable<ApiResponse<MonitorCamera>> {
    return this.http.get<ApiResponse<MonitorCamera>>(`${this.apiUrl}/${id}`);
  }
}

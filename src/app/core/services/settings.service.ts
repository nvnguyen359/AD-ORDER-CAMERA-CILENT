import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SystemConfig {
  aiConfig: {
    selectedCameraId: number;
    confidenceThreshold: number;
    debugMode: boolean;
    detectPerson: boolean;
    detectQR: boolean;
    enableROI: boolean;
  };
  operationConfig: {
    idleTimeoutSeconds: number;
    autoRecordOnQR: boolean;
    autoSnapshot: boolean;
    soundAlerts: boolean;
  };
  storageConfig: {
    storagePath: string;
    retentionDays: number;
    autoCleanup: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  // Đảm bảo URL trỏ đúng về backend
  private apiUrl = `${environment.apiUrl}`; // Hoặc `${environment.apiUrl}`

  constructor(private http: HttpClient) {}

  getCameras(): Observable<any[]> {
    // Thêm skip/limit nếu API yêu cầu
    return this.http.get<any>(`${this.apiUrl}/cameras`).pipe(
      map((res: any) => {
        // === FIX QUAN TRỌNG: Lấy dữ liệu từ thuộc tính .data ===
        const list = res.data || [];

        if (!Array.isArray(list)) {
            console.error('API Cameras trả về format lạ:', res);
            return [];
        }

        return list.map((cam: any) => ({
          label: cam.name || `Camera ${cam.id}`,
          value: cam.id
        }));
      })
    );
  }

  getSettings(): Observable<SystemConfig> {
    return this.http.get<SystemConfig>(`${this.apiUrl}/settings`);
  }

  saveSettings(config: SystemConfig): Observable<any> {
    return this.http.post(`${this.apiUrl}/settings`, config);
  }
}

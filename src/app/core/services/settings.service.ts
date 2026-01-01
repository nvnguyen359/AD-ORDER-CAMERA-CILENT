import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SystemConfig {
  aiConfig: {
    selectedCameraId: number | null; // Allow null
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
  times: {
    open: string;
    close: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  getCameras(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/cameras`).pipe(
      map((res: any) => {
        const list = res.data || [];
        if (!Array.isArray(list)) return [];
        return list.map((cam: any) => ({
          label: cam.name || `Camera ${cam.id}`,
          value: cam.id
        }));
      })
    );
  }

  getSettings(): Observable<SystemConfig> {
    // [FIX QUAN TRỌNG]: Thêm pipe map để lấy res.data
    return this.http.get<any>(`${this.apiUrl}/settings`).pipe(
      map(res => res.data as SystemConfig)
    );
  }

  saveSettings(config: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings`, config);
  }
}

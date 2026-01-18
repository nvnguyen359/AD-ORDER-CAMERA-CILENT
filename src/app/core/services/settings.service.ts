import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SettingResponse {
  code: number;
  mes: string;
  data: { [key: string]: string }; // Map key-value động
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`; // e.g., http://localhost:8000/api/v1

  // Lấy danh sách camera (cho dropdown)
  getCameras(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/cameras`).pipe(
      map((res: any) => {
        const list = res.data || [];
        return Array.isArray(list) ? list.map((cam: any) => ({
          label: `Camera ${cam.id}`,
          value: cam.id
        })) : [];
      })
    );
  }

  // GET Settings (Trả về JSON phẳng)
  getSettings(): Observable<{ [key: string]: string }> {
    return this.http.get<SettingResponse>(`${this.apiUrl}/settings/`).pipe(
      map(res => res.data)
    );
  }

  // POST Update Settings (Gửi JSON phẳng)
  updateSettings(settings: any): Observable<any> {
    return this.http.post<SettingResponse>(`${this.apiUrl}/settings/`, settings);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


// Định nghĩa interface cho response (tùy chọn nhưng nên có)
export interface SystemResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SystemService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/system`;

  /**
   * Gọi API khởi động lại hệ thống
   */
  reboot(): Observable<SystemResponse> {
    return this.http.post<SystemResponse>(`${this.apiUrl}/reboot`, {});
  }

  /**
   * Bật hoặc tắt Hotspot
   * @param action 'on' | 'off'
   */
  toggleHotspot(action: 'on' | 'off'): Observable<SystemResponse> {
    return this.http.post<SystemResponse>(`${this.apiUrl}/hotspot/${action}`, {});
  }
}

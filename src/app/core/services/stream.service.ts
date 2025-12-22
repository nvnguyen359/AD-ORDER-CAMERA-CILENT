import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { filter, share } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface StreamMessage {
  camera_id: number;
  image?: string;
  metadata?: any[];
  event?: string;
  data?: any;
  mode?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class StreamService {
  private http = inject(HttpClient);

  // [FIX QUAN TRỌNG]: Đổi đường dẫn sang '/oc-cameras/ws'
  private wsUrl = environment.apiUrl.replace(/^http/, 'ws') + '/oc-cameras/ws';

  private socket$: WebSocketSubject<StreamMessage> | null = null;
  private streamMessages$ = new Subject<StreamMessage>();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  // 1. Lấy danh sách Camera
  getCameras(): Observable<any> {
    // Nếu bạn dùng hệ thống mới hoàn toàn thì nên đổi thành /oc-cameras
    // return this.http.get(`${environment.apiUrl}/oc-cameras`);
    return this.http.get(`${environment.apiUrl}/cameras`);
  }

  // 2. Gửi lệnh Connect/Disconnect (Socket Logic trên Server)
  toggleCamera(id: number, action: 'connect' | 'disconnect'): Observable<any> {
    const url = `${environment.apiUrl}/oc-cameras/${id}/${action}`;
    return this.http.post(url, {});
  }

  // [MỚI] 3. API Quay thủ công (Manual Start)
  startRecording(id: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/oc-cameras/${id}/manual-start`, {});
  }

  // [MỚI] 4. API Dừng quay thủ công (Manual Stop)
  stopRecording(id: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/oc-cameras/${id}/manual-stop`, {});
  }

  // 5. Kết nối WebSocket
  connectSocket(token: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.socket$ && !this.socket$.closed) return;

    console.log(`[StreamService] Connecting WS: ${this.wsUrl}`);

    this.socket$ = webSocket<StreamMessage>({
      url: `${this.wsUrl}?token=${token}`,
      openObserver: { next: () => console.log('✅ WS Connected') },
      closeObserver: { next: () => console.log('❌ WS Closed') },
      // [QUAN TRỌNG] Thêm deserializer để tránh lỗi parse nếu server gửi text
      deserializer: (msg) => {
        try {
          return JSON.parse(msg.data);
        } catch (e) {
          return msg.data;
        }
      }
    });

    this.socket$.subscribe({
      next: (msg) => {
          // Log nhẹ để debug xem tin về chưa
          if(msg.event) console.log('🔥 Socket Event:', msg.event);
          this.streamMessages$.next(msg);
      },
      error: (err) => console.error('WS Error:', err),
      complete: () => console.log('WS Complete'),
    });
  }

  // 6. Lấy luồng dữ liệu riêng cho 1 Camera
  getCameraStream(cameraId: number): Observable<StreamMessage> {
    return this.streamMessages$.pipe(
      filter((msg) => msg.camera_id === cameraId),
      share()
    );
  }

  // 7. Đổi chế độ hiển thị (Client -> Server -> Client Broadcast)
  changeMode(camId: number, mode: string) {
    if (this.socket$) {
      this.socket$.next({ camera_id: camId, mode: mode } as any);
    }
  }

  disconnectSocket() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }
}

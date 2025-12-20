
import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, Subscription } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { filter, map, share } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface StreamMessage {
  camera_id: number;
  image?: string;    // Base64 image
  metadata?: any[];  // Box data
  event?: string;    // Order events
  data?: any;        // Event data
  mode?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class StreamService {
  private http = inject(HttpClient);
  // Tự động fix URL: http -> ws, https -> wss
  private wsUrl = environment.apiUrl.replace(/^http/, 'ws') + '/smart-stream/ws/smart-stream';

  private socket$: WebSocketSubject<StreamMessage> | null = null;

  // Dùng Subject để phát lại (multicast) dữ liệu cho nhiều subscriber
  private streamMessages$ = new Subject<StreamMessage>();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  // 1. Lấy danh sách Camera (HTTP)
  getCameras(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/cameras`);
  }

  // 2. Gửi lệnh Connect/Disconnect (HTTP)
  toggleCamera(id: number, action: 'connect' | 'disconnect'): Observable<any> {
    return this.http.post(`${environment.apiUrl}/cameras/${id}/${action}`, {});
  }

  // 3. Kết nối WebSocket (Chỉ 1 kết nối duy nhất cho toàn App)
  connectSocket(token: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.socket$ && !this.socket$.closed) return;

    console.log(`[StreamService] Connecting WS: ${this.wsUrl}`);

    this.socket$ = webSocket<StreamMessage>({
      url: `${this.wsUrl}?token=${token}`,
      openObserver: { next: () => console.log('✅ WS Connected') },
      closeObserver: { next: () => console.log('❌ WS Closed') }
    });

    this.socket$.subscribe({
      next: (msg) => this.streamMessages$.next(msg),
      error: (err) => console.error('WS Error:', err),
      complete: () => console.log('WS Complete')
    });
  }

  // 4. Lấy luồng dữ liệu riêng cho 1 Camera cụ thể (QUAN TRỌNG)
  getCameraStream(cameraId: number): Observable<StreamMessage> {
    return this.streamMessages$.pipe(
      filter(msg => msg.camera_id === cameraId),
      share() // Chia sẻ subscription để ko tạo nhiều side-effect
    );
  }

  // 5. Gửi lệnh đổi mode qua Socket
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

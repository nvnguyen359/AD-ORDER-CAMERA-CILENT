import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { filter, share, retryWhen, delay, tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../environments/environment';

// --- INTERFACES ---
export interface StreamMessage {
  camera_id?: number;
  image?: string;
  metadata?: any[];
  event?: string;
  data?: any;
  mode?: string;
  error?: string;
  timestamp?: string;
}

export interface StopRecordingBody {
  order_code: string;
  client_id?: number;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class StreamService {
  private http = inject(HttpClient);

  // Prefix API
  private readonly API_PREFIX = '/cameras';

  // Subject để bắn tin cho toàn bộ app
  private streamMessages$ = new Subject<StreamMessage>();
  public messages$ = this.streamMessages$.asObservable();

  private socket$: WebSocketSubject<StreamMessage> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  private get baseUrl() {
    return `${environment.apiUrl}${this.API_PREFIX}`;
  }

  private get wsUrl() {
    // Thay http -> ws, https -> wss
    return environment.apiUrl.replace(/^http/, 'ws') + this.API_PREFIX + '/ws';
  }

  // =================================================================
  // A. KẾT NỐI SOCKET
  // =================================================================

  /**
   * Kết nối WebSocket.
   * @param token (Optional) Nếu không truyền sẽ tự lấy từ localStorage
   * @param cameraId (Optional) ID Camera để filter ngay từ server (nếu backend hỗ trợ)
   */
  connectSocket(token?: string, cameraId?: number): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Nếu chưa có token, thử lấy từ localStorage
    if (!token) {
      token = localStorage.getItem('token') || '';
    }

    // Nếu đã kết nối rồi thì thôi (tránh tạo nhiều connection thừa)
    if (this.socket$ && !this.socket$.closed) {
        console.log('[StreamService] WS already connected.');
        return;
    }

    let userId: number | null = null;
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        userId = decoded.id || decoded.user_id || (Number(decoded.sub) ? Number(decoded.sub) : null);
      } catch (e) {
        console.error('[StreamService] Token decode error:', e);
      }
    }

    let url = `${this.wsUrl}?token=${token}`;
    if (userId) url += `&user_id=${userId}`;
    if (cameraId) url += `&camera_id=${cameraId}`;

    console.log(`[StreamService] Connecting WS...`);

    this.socket$ = webSocket<StreamMessage>({
      url: url,
      openObserver: { next: () => console.log('✅ WS Connected') },
      closeObserver: { next: () => console.log('❌ WS Closed') },
      deserializer: (msg) => {
        try { return JSON.parse(msg.data); } catch (e) { return msg.data; }
      }
    });

    this.socket$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => console.error('WS Error, Retry in 3s...', err)),
          delay(3000)
        )
      )
    ).subscribe({
      next: (msg) => {
        // Log để debug xem event có về không
        if (msg.event) console.log(`🔥 Socket Event [Cam ${msg.camera_id}]:`, msg.event, msg.data);

        // Đẩy tin nhắn vào dòng chảy chung
        this.streamMessages$.next(msg);
      },
      error: (err) => console.error('WS Fatal Error:', err),
      complete: () => console.log('WS Completed')
    });
  }

  disconnectSocket() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }

  // =================================================================
  // B. HELPER CHO COMPONENT (QUAN TRỌNG)
  // =================================================================

  /**
   * Lấy luồng dữ liệu của 1 Camera cụ thể.
   * [FIX] Dùng so sánh == thay vì === để tránh lỗi String vs Number
   */
  getCameraStream(cameraId: number): Observable<StreamMessage> {
    return this.messages$.pipe(
      filter((msg) => {
        // Backend gửi số, Frontend có thể là chuỗi -> Ép kiểu về String để so sánh an toàn
        return String(msg.camera_id) === String(cameraId);
      }),
      share()
    );
  }

  // =================================================================
  // C. API HTTP
  // =================================================================

  getCameras(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  toggleCamera(id: number, action: 'connect' | 'disconnect'): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/${action}`, {});
  }

  startRecording(id: number, width: number = 640, height: number = 480): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/manual-start?width=${width}&height=${height}`, {});
  }

  stopRecording(id: number, body: StopRecordingBody): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/manual-stop`, body);
  }

  getAIOverlay(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/ai-overlay`);
  }
}

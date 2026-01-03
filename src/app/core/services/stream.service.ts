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

// [MỚI] Interface cho body của API Stop Recording (khớp với ManualStopBody ở Backend)
export interface StopRecordingBody {
  order_code: string;  // Bắt buộc
  client_id?: number;  // Tùy chọn (User ID)
  note?: string;       // Tùy chọn
}

@Injectable({ providedIn: 'root' })
export class StreamService {
  private http = inject(HttpClient);

  // Prefix API
  private readonly API_PREFIX = '/cameras';

  private streamMessages$ = new Subject<StreamMessage>();
  public messages$ = this.streamMessages$.asObservable();

  private socket$: WebSocketSubject<StreamMessage> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  private get baseUrl() {
    return `${environment.apiUrl}${this.API_PREFIX}`;
  }

  private get wsUrl() {
    return environment.apiUrl.replace(/^http/, 'ws') + this.API_PREFIX + '/ws';
  }

  // =================================================================
  // A. PHẦN KẾT NỐI SOCKET (CORE)
  // =================================================================

  connectSocket(token: string = '', cameraId?: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.socket$ && !this.socket$.closed) return;

    // Giải mã Token để lấy User ID
    let userId: number | null = null;
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // Backend thường lưu ID trong claim 'id', 'user_id' hoặc 'sub'
        userId = decoded.id || decoded.user_id || (Number(decoded.sub) ? Number(decoded.sub) : null);
        console.log('[StreamService] Detected UserID from Token:', userId);
      } catch (e) {
        console.error('[StreamService] Failed to decode token:', e);
      }
    }

    // Xây dựng URL với user_id
    let url = `${this.wsUrl}?token=${token}`;

    // Gửi kèm user_id để Backend SocketManager lưu vào danh sách connection
    if (userId) url += `&user_id=${userId}`;
    if (cameraId) url += `&camera_id=${cameraId}`;

    console.log(`[StreamService] Connecting WS: ${url}`);

    this.socket$ = webSocket<StreamMessage>({
      url: url,
      openObserver: { next: () => console.log('✅ WS Connected') },
      closeObserver: { next: () => console.log('❌ WS Closed') },
      deserializer: (msg) => {
        try {
          return JSON.parse(msg.data);
        } catch (e) {
          return msg.data;
        }
      }
    });

    this.socket$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => console.error('WS Error, Reconnecting...', err)),
          delay(3000)
        )
      )
    ).subscribe({
      next: (msg) => {
        if (msg.event) console.log('🔥 Socket Event:', msg.event);
        this.streamMessages$.next(msg);
      },
      error: (err) => console.error('WS Fatal Error:', err),
      complete: () => console.log('WS Connection Completed')
    });
  }

  disconnectSocket() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }

  // =================================================================
  // B. CÁC API HTTP (ĐÃ CẬP NHẬT)
  // =================================================================

  getCameras(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  toggleCamera(id: number, action: 'connect' | 'disconnect'): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/${action}`, {});
  }

  /**
   * Bắt đầu ghi hình thủ công.
   * @param id ID Camera
   * @param width Độ rộng video (default 640)
   * @param height Chiều cao video (default 480)
   */
  startRecording(id: number, width: number = 640, height: number = 480): Observable<any> {
    // Backend nhận width/height qua Query Params
    return this.http.post(`${this.baseUrl}/${id}/manual-start?width=${width}&height=${height}`, {});
  }

  /**
   * Dừng ghi hình và lưu đơn hàng.
   * @param id ID Camera
   * @param body Object chứa order_code, client_id, note
   */
  stopRecording(id: number, body: StopRecordingBody): Observable<any> {
    // Backend nhận dữ liệu qua Body JSON (ManualStopBody)
    return this.http.post(`${this.baseUrl}/${id}/manual-stop`, body);
  }

  getAIOverlay(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/ai-overlay`);
  }

  // =================================================================
  // C. HELPER CHO COMPONENT
  // =================================================================

  getCameraStream(cameraId: number): Observable<StreamMessage> {
    return this.messages$.pipe(
      filter((msg) => msg.camera_id === cameraId),
      share()
    );
  }

  sendMessage(msg: any) {
    if (this.socket$) {
      this.socket$.next(msg);
    }
  }
}

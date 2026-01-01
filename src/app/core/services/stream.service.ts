import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { filter, share, retryWhen, delay, tap, catchError } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode'; // [FIX] Import jwt-decode
import { environment } from '../../environments/environment';

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

    // [FIX QUAN TRỌNG] Giải mã Token để lấy User ID
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

    // [FIX] Gửi kèm user_id để Backend SocketManager lưu vào danh sách connection
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
  // B. CÁC API HTTP
  // =================================================================

  getCameras(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  toggleCamera(id: number, action: 'connect' | 'disconnect'): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/${action}`, {});
  }

  startRecording(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/manual-start`, {});
  }

  stopRecording(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/manual-stop`, {});
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

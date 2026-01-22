import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { filter, share, retryWhen, delay, tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
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
  private readonly API_PREFIX = '/cameras';

  private streamMessages$ = new Subject<StreamMessage>();
  public messages$ = this.streamMessages$.asObservable();
  private socket$: WebSocketSubject<StreamMessage> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  private get baseUrl() { return `${environment.apiUrl}${this.API_PREFIX}`; }
  private get wsUrl() { return environment.apiUrl.replace(/^http/, 'ws') + this.API_PREFIX + '/ws'; }

  // --- SOCKET METHODS (Giữ nguyên) ---
  connectSocket(token?: string, cameraId?: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!token) token = localStorage.getItem('token') || '';
    if (this.socket$ && !this.socket$.closed) return;

    let userId: number | null = null;
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        userId = decoded.id || decoded.user_id || (Number(decoded.sub) ? Number(decoded.sub) : null);
      } catch (e) { console.error('[StreamService] Token decode error:', e); }
    }

    let url = `${this.wsUrl}?token=${token}`;
    if (userId) url += `&user_id=${userId}`;
    if (cameraId) url += `&camera_id=${cameraId}`;

    this.socket$ = webSocket<StreamMessage>({
      url: url,
      openObserver: { next: () => console.log('✅ WS Connected') },
      closeObserver: { next: () => console.log('❌ WS Closed') },
      deserializer: (msg) => { try { return JSON.parse(msg.data); } catch (e) { return msg.data; } }
    });

    this.socket$.pipe(
      retryWhen(errors => errors.pipe(delay(3000)))
    ).subscribe({
      next: (msg) => this.streamMessages$.next(msg),
      error: (err) => console.error('WS Fatal Error:', err)
    });
  }

  disconnectSocket() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }

  getCameraStream(cameraId: number): Observable<StreamMessage> {
    return this.messages$.pipe(
      filter((msg) => String(msg.camera_id) === String(cameraId)),
      share()
    );
  }

  // --- HTTP API METHODS ---

  getCameras(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  toggleCamera(id: number, action: 'connect' | 'disconnect'): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/${action}`, {});
  }

  // [FIX] Sửa lại gọi đúng API Backend /record?action=start
  startRecording(id: number, code: string = 'MANUAL'): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/record?action=start&code=${code}`, {});
  }

  // [FIX] Sửa lại gọi đúng API Backend /record?action=stop
  stopRecording(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/record?action=stop`, {});
  }

  getAIOverlay(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/ai-overlay`);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

// [SỬA] Dùng StorageService thay vì AuthService
import { StorageService } from './storage.service';
import { StreamPayload, AnalysisResult } from '../models/object-counter.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ObjectCounterService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService); // [SỬA] Inject StorageService

  private ws: WebSocket | null = null;
  private streamSubject = new Subject<StreamPayload>();

  public stream$ = this.streamSubject.asObservable();

  private apiUrl = `${environment.apiUrl}/object-counter`;
  private getWsBaseUrl() {
      if (environment.apiUrl) return environment.apiUrl;
      return environment.apiUrl.replace('http', 'ws');
  }

  // --- 1. WEBSOCKET (LIVE COUNTING) ---
  connect(cameraId: number): void {
    // [SỬA] Lấy token từ StorageService (Key thường là 'access_token' hoặc từ env)
    const token = this.storageService.getItem(environment.ACCESS_TOKEN_KEY);

    if (!token) {
        console.error('[ObjectCounter] Không tìm thấy Token đăng nhập!');
        return;
    }

    this.disconnect(); // Ngắt kết nối cũ

    const url = `${this.getWsBaseUrl()}/object-counter/ws/${cameraId}?token=${token}`;
    console.log(`[ObjectCounter] Connecting to: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
        console.log(`[ObjectCounter] Connected to Cam ${cameraId}`);
    };

    this.ws.onmessage = (event) => {
      try {
        // Parse dữ liệu từ Server gửi về
        // Format: { camera_id: 1, metadata: { count: 5, items: [...] }, image: "base64..." }
        const data: StreamPayload = JSON.parse(event.data);
        this.streamSubject.next(data);
      } catch (e) {
        console.error('[ObjectCounter] Parse Error', e);
      }
    };

    this.ws.onerror = (err) => {
        console.error('[ObjectCounter] WebSocket Error:', err);
    };

    this.ws.onclose = (event) => {
        console.log(`[ObjectCounter] Closed Cam ${cameraId}. Code: ${event.code}`);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // --- 2. API PHÂN TÍCH (IMAGE / VIDEO) ---
  analyzeImage(blob: Blob): Observable<AnalysisResult> {
    const formData = new FormData();
    formData.append('file', blob, 'snapshot.jpg');
    return this.http.post<AnalysisResult>(`${this.apiUrl}/analyze-image`, formData);
  }

  // --- 3. HELPER: CAPTURE FRAME ---
  captureFrame(element: HTMLImageElement | HTMLVideoElement): Blob | null {
    if (!element) return null;

    const canvas = document.createElement('canvas');
    // Với thẻ img, dùng naturalWidth. Với video, dùng videoWidth.
    const width = (element instanceof HTMLImageElement) ? element.naturalWidth : element.videoWidth;
    const height = (element instanceof HTMLImageElement) ? element.naturalHeight : element.videoHeight;

    if (!width || !height) return null;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(element, 0, 0, width, height);

    // Convert base64 -> Blob (đồng bộ)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return this.dataURItoBlob(dataUrl);
  }

  private dataURItoBlob(dataURI: string): Blob {
    const split = dataURI.split(',');
    const byteString = atob(split[1]);
    const mimeString = split[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }
}

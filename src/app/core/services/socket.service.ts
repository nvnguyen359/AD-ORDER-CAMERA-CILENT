import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;

  // Signal theo dõi trạng thái kết nối
  public isConnected = signal<boolean>(false);

  constructor() {
    // [FIX] Tự động xác định URL Backend dựa trên địa chỉ trình duyệt đang truy cập
    let socketUrl = environment.apiUrl;

    // Nếu không cấu hình cứng apiUrl trong environment, tự động lấy IP hiện tại + Port 8000
    if (!socketUrl) {
      const protocol = window.location.protocol; // 'http:' hoặc 'https:'
      const host = window.location.hostname;     // Lấy IP (vd: 192.168.1.50) hoặc domain
      socketUrl = `${protocol}//${host}:8000`;   // Ghép thành: http://192.168.1.50:8000
    }

    console.log('🔌 [Socket] Target URL:', socketUrl);

    this.socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket'], // Bắt buộc dùng websocket để giảm độ trễ cho Camera
      reconnectionAttempts: 10,
      reconnectionDelay: 3000
    });

    this.handleEvents();
  }

  private handleEvents() {
    this.socket.on('connect', () => {
      console.log('🚀 [Socket] Connected to Backend');
      this.isConnected.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ [Socket] Disconnected');
      this.isConnected.set(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️ [Socket] Connection Error:', error);
      this.isConnected.set(false);
    });
  }

  /**
   * Lắng nghe sự kiện từ Backend
   */
  onEvent<T>(eventName: string): Observable<T> {
    return new Observable<T>(observer => {
      this.socket.on(eventName, (data: T) => {
        observer.next(data);
      });

      // Cleanup khi unsubscribe
      return () => {
        this.socket.off(eventName);
      };
    });
  }

  /**
   * Gửi event lên Backend (nếu cần)
   */
  emit(eventName: string, data: any) {
    this.socket.emit(eventName, data);
  }
} 

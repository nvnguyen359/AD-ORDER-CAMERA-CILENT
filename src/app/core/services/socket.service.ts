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
    let socketUrl = environment.apiUrl; // VD: 'http://localhost:8000/api' hoặc '/api'

    // Xóa bỏ đuôi /api (nếu có) để Socket.IO không hiểu nhầm là Namespace
    if (socketUrl && socketUrl.endsWith('/api')) {
      socketUrl = socketUrl.substring(0, socketUrl.length - 4);
    }

    // Nếu socketUrl bị rỗng (ví dụ apiUrl gốc chỉ là '/api'),
    // tự động cấu trúc lại URL từ trình duyệt
    if (!socketUrl) {
      const protocol = window.location.protocol; // 'http:' hoặc 'https:'
      const host = window.location.hostname;     // Lấy IP (vd: 192.168.1.50)
      const port = window.location.port ? `:${window.location.port}` : '';

      // Nếu đang chạy dev (Frontend port 4200), ép trỏ về backend 8000.
      // Nếu ở production (Port rỗng, 80 hoặc 443), giữ nguyên port đó.
      const finalPort = port === ':4200' ? ':8000' : port;

      socketUrl = `${protocol}//${host}${finalPort}`;
    }

    console.log('🔌 [Socket] Target URL:', socketUrl);

    this.socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket'], // Bắt buộc dùng websocket để giảm độ trễ
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

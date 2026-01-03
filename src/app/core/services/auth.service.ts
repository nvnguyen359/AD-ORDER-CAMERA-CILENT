import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router'; // [BẮT BUỘC] Import Router
import { catchError, tap } from 'rxjs/operators';
import { Observable, throwError, of } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { MessageService } from 'primeng/api';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';
import { LoginResponse } from '../models/auth.model';
import { ToastSeverity } from '../enums'; // Đảm bảo file enums có ToastSeverity

const ACCESS_TOKEN_KEY = environment.ACCESS_TOKEN_KEY;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private messageService = inject(MessageService);
  private router = inject(Router); // [MỚI] Inject Router để điều hướng
  private apiUrl = `${environment.apiUrl}`;

  // Signal theo dõi trạng thái đăng nhập
  isAuthenticated = signal<boolean>(this.checkTokenIsValid());

  // [MỚI] Biến lưu URL để quay lại sau khi login thành công
  public redirectUrl: string | null = null;

  constructor() {
    console.log('Auth Status:', this.isAuthenticated() ? 'Logged In' : 'Guest');
  }

  // --- 1. ĐĂNG KÝ ---
  registerForm(form: any): Observable<any> {
    if (form.password !== form.confirmPassword) {
      const msg = `Tạo user: ${form.full_name} thất bại. Mật khẩu không khớp!`;
      this.showToast('error', 'Lỗi dữ liệu', msg);
      return throwError(() => new Error(msg));
    }

    const payload = { ...form };
    delete payload.confirmPassword;

    return this.http.post(`${this.apiUrl}/users`, payload).pipe(
      tap((response: any) => {
        // Giả sử API trả về code 200 là thành công
        if (response || response.code === 200) {
          this.showToast(
            ToastSeverity.SUCCESS, // Dùng Enum hoặc string 'success'
            'Thành công',
            `Tạo tài khoản ${response.full_name || form.username} thành công!`
          );
        }
      })
    );
  }

  // --- 2. ĐĂNG NHẬP ---
  loginForm(form: any): Observable<LoginResponse> {
    const formData = new FormData();
    formData.append('username', form.username);
    formData.append('password', form.password);

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, formData).pipe(
      tap((response) => {
        // 1. Lưu Token
        this.storageService.setItem(ACCESS_TOKEN_KEY, response.access_token);
        // 2. Cập nhật Signal
        this.isAuthenticated.set(true);
        // 3. Thông báo
        this.showToast(ToastSeverity.SUCCESS, 'Đăng nhập thành công', `Xin chào ${form.username}`);

        // Lưu ý: Việc redirect (quay lại trang cũ) sẽ do LoginComponent xử lý dựa trên this.redirectUrl
      }),
      catchError((error) => {
        this.showToast(ToastSeverity.ERROR, 'Đăng nhập thất bại!', `Kiểm tra lại tài khoản/mật khẩu`);
        return throwError(() => error);
      })
    );
  }

  // --- 3. ĐĂNG XUẤT ---
  logout() {
    // 1. Xóa token
    this.storageService.removeItem(ACCESS_TOKEN_KEY);
    // 2. Cập nhật Signal
    this.isAuthenticated.set(false);
    // 3. Xóa url redirect cũ (nếu có)
    this.redirectUrl = null;
    // 4. [QUAN TRỌNG] Đá về trang Login
    this.router.navigate(['/login']);

    this.showToast('info', 'Đăng xuất', 'Hẹn gặp lại!');
  }

  // --- 4. CHECK TOKEN (Public để AuthGuard gọi) ---
  public checkTokenIsValid(): boolean {
    const token = this.storageService.getItem(ACCESS_TOKEN_KEY);
    if (!token) return false;

    try {
      const decoded: any = jwtDecode(token);
      // Kiểm tra hết hạn (exp tính bằng giây, Date.now() tính bằng ms)
      const isExpired = decoded.exp < Date.now() / 1000;

      if (isExpired) {
        this.storageService.removeItem(ACCESS_TOKEN_KEY);
        return false;
      }
      return true;
    } catch (e) {
      this.storageService.removeItem(ACCESS_TOKEN_KEY);
      return false;
    }
  }

  // --- 5. HELPER LẤY USER ID ---
  getCurrentUserId(): number | null {
    const token = this.storageService.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      // Ưu tiên các key phổ biến trong JWT
      return decoded.id || decoded.user_id || (Number(decoded.sub) ? Number(decoded.sub) : null);
    } catch {
      return null;
    }
  }

  // Helper Toast
  private showToast(
    severity: string, // Cho phép string để linh hoạt nếu không dùng Enum
    summary: string,
    detail: string
  ) {
    this.messageService.add({
      severity: severity as any,
      summary,
      detail,
      life: 5000,
      key: 'global', // Đảm bảo <p-toast key="global"> hoặc bỏ key nếu dùng mặc định
    });
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { Observable, throwError, of } from 'rxjs'; // Thêm 'of'
import { jwtDecode } from 'jwt-decode';
import { MessageService } from 'primeng/api';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';
import { LoginResponse } from '../models/auth.model';
import { ToastSeverity } from '../enums';

const ACCESS_TOKEN_KEY = environment.ACCESS_TOKEN_KEY;

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Dùng inject() cho đồng bộ, bỏ constructor rườm rà
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private messageService = inject(MessageService);
  private apiUrl = `${environment.apiUrl}`;

  // Signal: True = Đã đăng nhập, False = Chưa đăng nhập
  isAuthenticated = signal<boolean>(this.checkTokenIsValid());

  constructor() {
    console.log('Auth Status:', this.isAuthenticated() ? 'Logged In' : 'Guest');
  }

  // --- 1. ĐĂNG KÝ ---
  registerForm(form: any): Observable<any> {
    // Validate Client-side: Mật khẩu không khớp
    if (form.password !== form.confirmPassword) {
      const msg = `Tạo user: ${form.full_name} thất bại. Mật khẩu không khớp!`;

      this.showToast('error', 'Lỗi dữ liệu', msg);

      // Trả về lỗi Observable để component nhận biết (thay vì trả về object form)
      return throwError(() => new Error(msg));
    }

    // Xóa trường thừa trước khi gửi
    const payload = { ...form }; // Copy ra object mới để tránh sửa form gốc
    delete payload.confirmPassword;

    return this.http.post(`${this.apiUrl}/users`, payload).pipe(
      tap((response: any) => {
        // Chỉ hiện thông báo thành công.
        // Loading tự tắt do Interceptor.
        // Lỗi tự hiện do ErrorInterceptor.
        if (response.code === 200) {
           this.showToast(ToastSeverity.SUCCESS, 'Thành công', `Tạo tài khoản ${response.full_name} thành công!`);
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
        // 1. Lưu token
        this.storageService.setItem(ACCESS_TOKEN_KEY, response.access_token);

        // 2. Cập nhật trạng thái Signal (True = Đã Login)
        this.isAuthenticated.set(true);

        // 3. Hiện thông báo (Thêm key: 'global' nếu app.html có set key)
        this.showToast(ToastSeverity.SUCCESS, 'Đăng nhập thành công', `Xin chào ${form.username}`);

      }),catchError((error) => {
           this.showToast(ToastSeverity.ERROR, 'Đăng nhập thất bại!', `Xin chào ${form.username}`);
        return throwError(() => error);
      })

    );
  }

  // --- 3. ĐĂNG XUẤT ---
  logout() {
    this.storageService.removeItem(ACCESS_TOKEN_KEY);
    this.isAuthenticated.set(false);
    this.showToast('info', 'Đăng xuất', 'Hẹn gặp lại!');
  }

  // --- 4. CHECK TOKEN HỢP LỆ (Logic chuẩn) ---
  // Trả về TRUE nếu token TỐT (chưa hết hạn)
  // Trả về FALSE nếu không có token hoặc hết hạn
  private checkTokenIsValid(): boolean {
    const token = this.storageService.getItem(ACCESS_TOKEN_KEY);
    if (!token) return false; // Không có token -> Chưa login

    try {
      const decoded: any = jwtDecode(token);
      const isExpired = decoded.exp < Date.now() / 1000;

      if (isExpired) {
        this.storageService.removeItem(ACCESS_TOKEN_KEY);
        return false;
      }
      return true; // Token còn hạn -> Đã login
    } catch (e) {
      this.storageService.removeItem(ACCESS_TOKEN_KEY);
      return false;
    }
  }

  // Helper hiển thị Toast gọn gàng
  private showToast(severity: 'success' | 'error' | 'info' | 'warn', summary: string, detail: string) {
    this.messageService.add({
      severity,
      summary,
      detail,
      life: 5000,
      key: 'global' // QUAN TRỌNG: Phải khớp với <p-toast key="global"> bên HTML
    });
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { Observable, throwError, of } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { MessageService } from 'primeng/api';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';
import { LoginResponse } from '../models/auth.model';
import { ToastSeverity } from '../enums';

const ACCESS_TOKEN_KEY = environment.ACCESS_TOKEN_KEY;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private messageService = inject(MessageService);
  private apiUrl = `${environment.apiUrl}`;

  isAuthenticated = signal<boolean>(this.checkTokenIsValid());

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
        this.storageService.setItem(ACCESS_TOKEN_KEY, response.access_token);
        this.isAuthenticated.set(true);
        this.showToast(ToastSeverity.SUCCESS, 'Đăng nhập thành công', `Xin chào ${form.username}`);
      }),
      catchError((error) => {
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

  // --- 4. CHECK TOKEN ---
  private checkTokenIsValid(): boolean {
    const token = this.storageService.getItem(ACCESS_TOKEN_KEY);
    if (!token) return false;

    try {
      const decoded: any = jwtDecode(token);
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

  // --- 5. [FIX] HELPER LẤY USER ID ---
  // Hàm này giúp các component khác lấy ID người dùng hiện tại
  getCurrentUserId(): number | null {
    const token = this.storageService.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      // Ưu tiên các key phổ biến
      return decoded.id || decoded.user_id || (Number(decoded.sub) ? Number(decoded.sub) : null);
    } catch {
      return null;
    }
  }

  // Helper Toast
  private showToast(severity: 'success' | 'error' | 'info' | 'warn', summary: string, detail: string) {
    this.messageService.add({
      severity,
      summary,
      detail,
      life: 5000,
      key: 'global'
    });
  }
}
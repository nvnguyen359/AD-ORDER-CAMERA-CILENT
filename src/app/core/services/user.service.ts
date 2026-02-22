import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserUpdate } from '../models/user.models';

// --- Định nghĩa các Interface khớp với Backend ---
export interface User {
  id: number;
  username: string;
  full_name?: string;
  role: string; // 'admin', 'supervisor', 'operator'
  is_active: number; // Backend trả về 1 hoặc 0
  created_at?: string;
  updated_at?: string;
}

export interface UserCreate {
  username: string;
  password?: string; // Chỉ gửi khi tạo, không nhận về
  full_name?: string;
  role: string;
}

// Interface dùng chung cho format response_success của Backend
export interface ApiResponse<T> {
  code: number;
  mes: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);

  // Nối prefix '/users' vào sau apiUrl (vd: http://localhost:8000/api/users)
  private apiUrl = `${environment.apiUrl}/users`;

  constructor() {}

  /**
   * 1. Lấy danh sách User có phân trang và lọc
   * API: GET /users?skip=0&limit=100&search=abc&role=admin
   */
  getUsers(params?: { skip?: number; limit?: number; search?: string; role?: string }): Observable<ApiResponse<User[]>> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.skip !== undefined) httpParams = httpParams.set('skip', params.skip);
      if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.role) httpParams = httpParams.set('role', params.role);
    }

    return this.http.get<ApiResponse<User[]>>(this.apiUrl, { params: httpParams });
  }

  /**
   * 2. Lấy thông tin chi tiết 1 User
   * API: GET /users/{id}
   */
  getUserById(id: number): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/${id}`);
  }

  /**
   * 3. Tạo User mới
   * API: POST /users
   */
  createUser(userData: UserCreate): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(this.apiUrl, userData);
  }

  /**
   * 4. Kích hoạt User (is_active = 1)
   * API: POST /users/{id}/activate
   */
  activateUser(id: number): Observable<ApiResponse<User>> {
    // Truyền {} làm body vì POST method của Angular bắt buộc có body
    return this.http.post<ApiResponse<User>>(`${this.apiUrl}/${id}/activate`, {});
  }

  /**
   * 5. Vô hiệu hóa User (Khóa tài khoản - is_active = 0)
   * API: POST /users/{id}/deactivate
   */
  deactivateUser(id: number): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.apiUrl}/${id}/deactivate`, {});
  }
  /**
   * Cập nhật thông tin User
   * API: PATCH /users/{id}
   */
  updateUser(id: number, userData: UserUpdate): Observable<ApiResponse<User>> {
    return this.http.patch<ApiResponse<User>>(`${this.apiUrl}/${id}`, userData);
  }
}

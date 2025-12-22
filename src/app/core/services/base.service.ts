import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export abstract class BaseService<T> {
  protected http = inject(HttpClient);
  protected abstract endpoint: string;

  protected get apiUrl(): string {
    return `${environment.apiUrl}/${this.endpoint}`;
  }

  /**
   * Lấy danh sách có phân trang, filter, sort
   * @param params Object chứa page, pageSize, sort_by, filter...
   */
  findAll(params?: any): Observable<any> {
    const httpParams = this.createHttpParams(params);
    return this.http.get<any>(this.apiUrl, { params: httpParams });
  }

  getById(id: number | string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${id}`);
  }

  create(dto: Partial<T>): Observable<T> {
    return this.http.post<T>(this.apiUrl, dto);
  }

  update(id: number | string, dto: Partial<T>): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number | string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  // Helper: Chuyển đổi Object sang HttpParams sạch
  private createHttpParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;

    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        // Nếu value là object (ví dụ filter phức tạp), có thể cần stringify hoặc xử lý riêng
        httpParams = httpParams.append(key, value);
      }
    });

    return httpParams;
  }
}

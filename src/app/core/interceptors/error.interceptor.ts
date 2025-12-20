import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Đã xảy ra lỗi không xác định!';
      let errorSummary = 'Lỗi';

      // Xử lý các mã lỗi HTTP phổ biến
      switch (error.status) {
        case 400:
          // Lỗi dữ liệu gửi đi (Bad Request)
          errorSummary = 'Dữ liệu không hợp lệ';
          // Ưu tiên lấy message từ Backend trả về
          errorMessage = error.error?.message || 'Vui lòng kiểm tra lại dữ liệu đầu vào.';
          break;

        case 401:
          // Hết hạn token hoặc chưa đăng nhập
          errorSummary = 'Hết phiên đăng nhập';
          errorMessage = 'Vui lòng đăng nhập lại.';

          // Logic Logout: Xóa token và đá về login
          localStorage.clear(); // Hoặc gọi authService.logout()
          router.navigate(['/auth/login']);
          break;

        case 403:
          // Không có quyền truy cập
          errorSummary = 'Từ chối truy cập';
          errorMessage = 'Bạn không có quyền thực hiện thao tác này.';
          break;

        case 404:
          errorSummary = 'Không tìm thấy';
          errorMessage = 'Tài nguyên bạn tìm kiếm không tồn tại.';
          break;

        case 500:
          errorSummary = 'Lỗi hệ thống';
          errorMessage = 'Server đang gặp sự cố, vui lòng thử lại sau.';
          break;

        case 0:
          // Lỗi mạng hoặc Server chết hẳn
          errorSummary = 'Lỗi kết nối';
          errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền.';
          break;

        default:
          errorMessage = error.error?.message || error.message;
          break;
      }

      // Hiển thị Toast thông báo (Chỉ hiện nếu không phải 401 để tránh spam khi redirect)
      if (error.status !== 401) {
        messageService.add({
          severity: 'error',
          summary: errorSummary,
          detail: errorMessage,
          life: 3000 // Hiện trong 3 giây
        });
      }

      // Re-throw error để Component vẫn có thể subscribe error nếu muốn xử lý riêng
      return throwError(() => error);
    })
  );
};

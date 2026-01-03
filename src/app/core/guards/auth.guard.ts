import { inject } from '@angular/core';
import { Router, CanActivateFn, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Kiểm tra Token có hợp lệ không
  if (authService.checkTokenIsValid()) {
    return true; // Cho qua
  }

  // 2. Nếu không hợp lệ (Hết hạn hoặc chưa đăng nhập)
  console.log('Access Denied. Redirecting to Login...');

  // [QUAN TRỌNG] Lưu lại URL mà người dùng đang cố vào (VD: /admin/orders)
  authService.redirectUrl = state.url;

  // 3. Đá về trang Login
  router.navigate(['/login']);
  return false;
};

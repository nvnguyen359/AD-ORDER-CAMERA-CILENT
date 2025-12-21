import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
// 👇 1. Import AuthInterceptor vừa tạo
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),

    // 👇 2. Đăng ký authInterceptor vào đây
    // Thứ tự rất quan trọng: Auth -> Loading -> Error
    provideHttpClient(
        withInterceptors([
            authInterceptor,    // Gắn Token trước
            loadingInterceptor, // Sau đó bật loading
            errorInterceptor    // Cuối cùng bắt lỗi
        ])
    ),

    MessageService,
    providePrimeNG({
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: '.my-app-dark',
                cssLayer: {
                    name: 'primeng',
                    order: 'tailwind-base, primeng, tailwind-utilities'
                }
            }
        },
        ripple: true
    })
  ],
};

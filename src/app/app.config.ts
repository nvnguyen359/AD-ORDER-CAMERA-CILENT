import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

// Import file routes và interceptors của bạn
import { routes } from './app.routes';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. Router
    provideRouter(routes),

    // 2. Animations (CHỈ DÙNG 1 CÁI - Khuyên dùng Async cho nhanh)
    provideAnimationsAsync(),

    // 3. HttpClient (QUAN TRỌNG: Gộp hết vào 1 dòng này)
    provideHttpClient(
        withInterceptors([loadingInterceptor, errorInterceptor])
    ),

    // 4. Global Services (Để MessageService ở đây là đúng rồi)
    MessageService,

    // 5. Cấu hình PrimeNG
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

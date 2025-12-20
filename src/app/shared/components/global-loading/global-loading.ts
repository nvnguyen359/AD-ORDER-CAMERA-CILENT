import { Component } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-global-loading',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule],
  template: `
    <div class="loading-overlay">
      <div class="loading-content">
        <p-progressSpinner
          strokeWidth="4"
          animationDuration=".8s"
          styleClass="w-4rem h-4rem">
        </p-progressSpinner>
        <div class="loading-text">Đang xử lý...</div>
      </div>
    </div>
  `,
  styles: [`
    .loading-overlay {
      position: fixed; /* Cố định toàn màn hình */
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.4); /* Nền tối mờ */
      z-index: 99999; /* Đè lên tất cả */
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px); /* Hiệu ứng mờ nền đẹp mắt (Optional) */
    }
    .loading-text {
      color: white;
      font-weight: bold;
      margin-top: 1rem;
      font-size: 1.2rem;
      text-align: center;
    }
  `]
})
export class GlobalLoadingComponent {}

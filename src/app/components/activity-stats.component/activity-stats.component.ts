import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StreamService } from '../../core/services/stream.service'; // Giả sử service này quản lý socket
import { Subscription } from 'rxjs';
import { StatsService } from '../../core/services/stats.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-activity-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-stats.component.html',
  styleUrls: ['./activity-stats.component.scss']
})
export class ActivityStatsComponent implements OnInit, OnDestroy {
  private statsService = inject(StatsService);
  private streamService = inject(StreamService); // Service nhận Socket message
  private sub: Subscription | null = null;
  private router = inject(Router);
  // Sử dụng Signal cho hiệu năng cao
  completedCount = signal<number>(0);
  packingCount = signal<number>(0);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    // 1. Lấy số liệu gốc từ API khi mới load
    this.fetchInitialStats();

    // 2. Lắng nghe Socket để cập nhật Realtime
    // (Subscribe vào luồng tin nhắn chung của ứng dụng)
    this.sub = this.streamService.messages$.subscribe((msg: any) => {
      this.handleSocketMessage(msg);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private fetchInitialStats() {
    this.statsService.getDailyStats().subscribe({
      next: (data) => {
        this.completedCount.set(data.completed);
        this.packingCount.set(data.packing);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi lấy thống kê:', err);
        this.isLoading.set(false);
      }
    });
  }

  private handleSocketMessage(msg: any) {
    if (!msg || !msg.event) return;

    // LOGIC CẬP NHẬT SỐ LIỆU TỨC THÌ
    switch (msg.event) {
      case 'ORDER_CREATED':
        // Có đơn mới bắt đầu đóng -> Tăng số đang đóng
        this.packingCount.update(v => v + 1);
        break;

      case 'ORDER_STOPPED':
        // Một đơn vừa kết thúc -> Giảm đang đóng, Tăng đã xong
        this.packingCount.update(v => Math.max(0, v - 1)); // Tránh âm
        this.completedCount.update(v => v + 1);
        break;

      // Trường hợp 'ORDER_UPDATED' (Update Avatar) không ảnh hưởng số lượng nên bỏ qua
    }
  }
  navigateToHistory() {
    this.router.navigate(['/history']);
  }
}

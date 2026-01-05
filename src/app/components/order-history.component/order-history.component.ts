import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter, inject, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';

import { environment } from '../../environments/environment';

export interface TimelineStep {
  data: any;
  isCodeChanged: boolean;
  timeStr: string;
}

export interface SessionGroup {
  rootId: number;
  dateLabel: string;
  latestOrder: any;
  steps: TimelineStep[];
  totalSteps: number;
  durationStr: string;
  isManual: boolean;
  isExpanded: boolean; // Trạng thái mở rộng/thu gọn
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [
    CommonModule, ButtonModule, AvatarModule, TooltipModule, BadgeModule
  ],
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.scss']
})
export class OrderHistoryComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() orders: any[] = [];
  @Input() isLoadingMore: boolean = false; // Trạng thái đang tải thêm trang
  @Input() hasMoreData: boolean = true;    // Còn dữ liệu để tải không

  @Output() loadMore = new EventEmitter<void>(); // Bắn sự kiện ra cha để tải thêm

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  private router = inject(Router);
  private scrollObserver: IntersectionObserver | null = null;

  sessionGroups = signal<SessionGroup[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orders']) {
      // Mỗi khi danh sách orders thay đổi (do search mới hoặc load more), tính toán lại nhóm
      const groups = this.processData(this.orders || []);
      this.sessionGroups.set(groups);
    }
  }

  ngAfterViewInit() {
    this.setupInfiniteScroll();
  }

  ngOnDestroy() {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }
  }

  // --- LOGIC GOM NHÓM ---
  private processData(list: any[]): SessionGroup[] {
    if (!list || list.length === 0) return [];

    const itemMap = new Map(list.map(i => [i.id, i]));
    const findRoot = (item: any): number => {
      if (!item.parent_id) return item.id;
      // Chỉ đệ quy nếu cha tồn tại trong list hiện tại (để tránh lỗi khi phân trang cắt ngang)
      // Nếu không tìm thấy cha trong batch này, tạm coi chính nó là root của batch đó
      return itemMap.has(item.parent_id) ? findRoot(itemMap.get(item.parent_id)) : item.id;
    };

    const groupMap = new Map<number, any[]>();
    list.forEach(item => {
      const rootId = findRoot(item);
      if (!groupMap.has(rootId)) groupMap.set(rootId, []);
      groupMap.get(rootId)?.push(item);
    });

    const result: SessionGroup[] = [];
    groupMap.forEach((items, rootId) => {
      // Sort DESC (Mới nhất lên đầu)
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const latest = items[0];
      const oldest = items[items.length - 1];
      const isManual = latest.code.startsWith('DH-');

      const timelineSteps: TimelineStep[] = items.map((item, index) => {
        const previousStep = items[index + 1];
        let isCodeChanged = false;
        if (previousStep && item.code !== previousStep.code) isCodeChanged = true;

        return {
          data: item,
          isCodeChanged: isCodeChanged,
          timeStr: new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
      });

      const dateObj = new Date(latest.created_at);
      const dateLabel = dateObj.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

      let durationStr = 'Vài giây';
      if (items.length > 1) {
          const start = new Date(oldest.start_at || oldest.created_at).getTime();
          const end = new Date(latest.closed_at || latest.created_at).getTime();
          const min = Math.floor((end - start) / 60000);
          durationStr = min > 0 ? `${min} phút` : 'Wait...';
      }

      // Giữ trạng thái expand cũ nếu có (để khi load more không bị đóng lại các cái đang xem)
      // Tuy nhiên logic đơn giản nhất là: Mới tạo thì đóng (false).
      result.push({
        rootId: rootId,
        dateLabel: dateLabel,
        latestOrder: latest,
        steps: timelineSteps,
        totalSteps: items.length,
        durationStr: durationStr,
        isManual: isManual,
        isExpanded: false // Mặc định thu gọn
      });
    });

    // Sort Groups theo thời gian mới nhất
    result.sort((a, b) => new Date(b.latestOrder.created_at).getTime() - new Date(a.latestOrder.created_at).getTime());

    return result;
  }

  // --- INFINITE SCROLL ---
  private setupInfiniteScroll() {
    // Tạo một Observer để theo dõi phần tử "Sentinel" ở cuối danh sách
    const options = {
      root: null, // viewport
      rootMargin: '100px', // Load trước khi cuộn tới đáy 100px
      threshold: 0.1
    };

    this.scrollObserver = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && !this.isLoadingMore && this.hasMoreData) {
        this.loadMore.emit();
      }
    }, options);

    // Tìm phần tử sentinel trong DOM
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) this.scrollObserver.observe(sentinel);
  }

  // --- ACTIONS ---
  toggleExpand(group: SessionGroup, event: Event) {
    event.stopPropagation(); // Tránh click nhầm nút khác
    group.isExpanded = !group.isExpanded;
  }

  viewDetail(order: any) {
    // [CẬP NHẬT QUAN TRỌNG]: Truyền thêm playId vào queryParams
    // Để trang Detail biết cần play video của đơn hàng nào (Cha hay Con)
    this.router.navigate(['/order-detail', order.code], {
      queryParams: { playId: order.id }
    });
  }

  getAvatar(path: string): string {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      const cleanPath = path.replace(/^(\.\.\/)+/, '');
      return `${environment.apiUrl}/${cleanPath}`;
  }
}

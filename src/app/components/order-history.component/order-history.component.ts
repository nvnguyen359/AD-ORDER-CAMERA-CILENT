import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter, inject, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';

import { environment } from '../../environments/environment';

export interface TimelineStep {
  data: any;
  isCodeChanged: boolean;
  timeStr: string;
  fullDateTimeStr: string;
}

export interface SessionGroup {
  stt: number;
  rootId: number;
  dateLabel: string;
  timeLabel: string;
  latestOrder: any;
  steps: TimelineStep[];
  totalSteps: number;
  repackCount: number;
  realCount: number;
  durationStr: string;
  isExpanded: boolean;
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [
    CommonModule, ButtonModule, AvatarModule, TooltipModule, BadgeModule, TagModule
  ],
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.scss'],
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({ height: '0px', opacity: 0, overflow: 'hidden', paddingTop: '0px', paddingBottom: '0px' })),
      state('expanded', style({ height: '*', opacity: 1, overflow: 'hidden', paddingTop: '*', paddingBottom: '*' })),
      transition('collapsed <=> expanded', [animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)')])
    ]),
    trigger('rotateIcon', [
      state('collapsed', style({ transform: 'rotate(0deg)' })),
      state('expanded', style({ transform: 'rotate(180deg)' })),
      transition('collapsed <=> expanded', animate('300ms ease-out'))
    ])
  ]
})
export class OrderHistoryComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() orders: any[] = [];
  @Input() isLoadingMore: boolean = false;
  @Input() hasMoreData: boolean = true;

  @Output() loadMore = new EventEmitter<void>();

  // [ĐÃ XÓA] Output totalChange vì không cần thiết nữa

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  private router = inject(Router);
  private scrollObserver: IntersectionObserver | null = null;

  sessionGroups = signal<SessionGroup[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orders']) {
      // Chỉ xử lý dữ liệu để hiển thị, không tính toán tổng số nữa
      const groups = this.processData(this.orders || []);
      this.sessionGroups.set(groups);
    }
  }

  ngAfterViewInit() {
    this.setupInfiniteScroll();
  }

  ngOnDestroy() {
    if (this.scrollObserver) this.scrollObserver.disconnect();
  }

  private processData(list: any[]): SessionGroup[] {
    if (!list || list.length === 0) return [];

    return list.map((mainItem, index) => {
      const history = mainItem.history_logs || [];
      const allItems = [mainItem, ...history];
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const latest = allItems[0];
      const repackItems = allItems.filter(i => i.parent_id != null || (i.note && (i.note.toLowerCase().includes('repack') || i.note.toLowerCase().includes('check'))));

      const totalSteps = allItems.length;
      const repackCount = repackItems.length;
      let realCount = totalSteps - repackCount;
      if (realCount < 0) realCount = 0;

      const steps: TimelineStep[] = allItems.map((item, idx) => {
        const olderItem = allItems[idx + 1];
        const isCodeChanged = olderItem && item.code !== olderItem.code;
        const d = new Date(item.created_at);
        return {
          data: item,
          isCodeChanged: !!isCodeChanged,
          timeStr: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          fullDateTimeStr: d.toLocaleString('vi-VN')
        };
      });

      const dateObj = new Date(latest.created_at);
      return {
        stt: index + 1,
        rootId: Number(latest.id),
        dateLabel: dateObj.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        timeLabel: dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        latestOrder: latest,
        steps: steps,
        totalSteps,
        repackCount,
        realCount,
        durationStr: '',
        isExpanded: false
      };
    });
  }

  private setupInfiniteScroll() {
    const options = { root: null, rootMargin: '100px', threshold: 0.1 };
    this.scrollObserver = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && !this.isLoadingMore && this.hasMoreData) {
        this.loadMore.emit();
      }
    }, options);

    setTimeout(() => {
        const sentinel = document.getElementById('scroll-sentinel');
        if (sentinel) this.scrollObserver?.observe(sentinel);
    }, 500);
  }

  toggleExpand(group: SessionGroup, event: Event) {
    event.stopPropagation();
    const wasExpanded = group.isExpanded;

    this.sessionGroups.update(groups => {
        groups.forEach(g => { if (g.rootId !== group.rootId) g.isExpanded = false; });
        return [...groups];
    });

    group.isExpanded = !wasExpanded;

    if (group.isExpanded) {
        setTimeout(() => {
            const element = (event.target as HTMLElement).closest('.history-card');
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
  }

  viewDetail(order: any, rootCode?: string) {
    const codeToFetch = rootCode || order.code;
    this.router.navigate(['/order-detail', codeToFetch], { queryParams: { playId: order.id } });
  }

  getAvatar(path: string): string {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      const cleanPath = path.replace(/^(\.\.\/)+/, '');
      return `${environment.apiUrl}/${cleanPath}`;
  }
}

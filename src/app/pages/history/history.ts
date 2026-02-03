import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OrderSearchComponent } from '../../components/order-search.component/order-search.component';
import { OrderHistoryComponent } from '../../components/order-history.component/order-history.component';
import { OrderService } from '../../core/services/order.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    OrderSearchComponent,
    OrderHistoryComponent
  ],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  private orderService = inject(OrderService);

  orders = signal<any[]>([]);

  // Biến lưu tổng số lượng đơn hàng (chính xác)
  totalRecords = signal<number>(0);

  currentPage = 0;
  pageSize = 20;
  currentParams: any = {};

  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  hasMoreData = signal<boolean>(true);
  hasSearched = signal<boolean>(false);

  ngOnInit() {}

  filterChange(params: any) {
    this.currentParams = { ...params };
    this.currentPage = 0;
    this.orders.set([]);
    this.hasMoreData.set(true);
    this.hasSearched.set(true);
    this.isLoading.set(true);
    this.totalRecords.set(0);

    this.fetchData(false);
  }

  onLoadMore() {
    if (this.isLoadingMore() || !this.hasMoreData() || this.isLoading()) return;
    this.currentPage++;
    this.isLoadingMore.set(true);
    this.fetchData(true);
  }

  private fetchData(isAppend: boolean = false) {
    const apiParams = {
        ...this.currentParams,
        page: this.currentPage,
        page_size: this.pageSize
    };

    this.orderService.getOrders(apiParams).subscribe({
      next: (res: any) => {
        const responseData = res.data || {};
        const newData = responseData.items || [];

        // [FIX CHÍNH XÁC] Lấy 'total' từ API. Field này đếm số đơn hàng (items).
        // Nếu API backend chưa trả về field 'total', nó sẽ lấy newData.length (cho trang đầu).
        const total = responseData.total !== undefined ? responseData.total : newData.length;

        if (newData.length < this.pageSize) {
            this.hasMoreData.set(false);
        }

        if (isAppend) {
            this.orders.update(oldOrders => [...oldOrders, ...newData]);
            this.isLoadingMore.set(false);
        } else {
            this.orders.set(newData);
            // Cập nhật tổng số đơn hàng vào Badge
            this.totalRecords.set(newData.length||0);
            this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('History API Error:', err);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      }
    });
  }
}

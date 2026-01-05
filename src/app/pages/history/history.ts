import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// Components
import { OrderSearchComponent } from '../../components/order-search.component/order-search.component';


// Services
import { OrderService } from '../../core/services/order.service';
import { OrderHistoryComponent } from '../../components/order-history.component/order-history.component';

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

  // --- STATE DỮ LIỆU ---
  orders = signal<any[]>([]); // Danh sách đơn hàng hiển thị (Tích lũy)

  // --- STATE PHÂN TRANG ---
  currentPage = 0;
  pageSize = 20;        // Số lượng group/item load mỗi lần
  currentParams: any = {}; // Lưu lại bộ lọc hiện tại (code, date...) để dùng khi load more

  // --- STATE TRẠNG THÁI ---
  isLoading = signal<boolean>(false);     // Loading quay giữa màn hình (lần đầu)
  isLoadingMore = signal<boolean>(false); // Loading quay ở dưới đáy (khi cuộn)
  hasMoreData = signal<boolean>(true);    // Còn dữ liệu để load nữa không?
  hasSearched = signal<boolean>(false);   // Đã thực hiện tìm kiếm chưa?

  ngOnInit() {}

  /**
   * 1. XỬ LÝ SỰ KIỆN TÌM KIẾM (Từ OrderSearchComponent)
   * Reset toàn bộ state về ban đầu và gọi API trang 0.
   */
  filterChange(params: any) {
    this.currentParams = { ...params }; // Lưu params

    // Reset state
    this.currentPage = 0;
    this.orders.set([]);
    this.hasMoreData.set(true);
    this.hasSearched.set(true);
    this.isLoading.set(true);

    // Gọi API load mới
    this.fetchData(false);
  }

  /**
   * 2. XỬ LÝ SỰ KIỆN LOAD MORE (Từ OrderHistoryComponent bắn lên)
   * Tăng page lên 1 và gọi API nối thêm dữ liệu.
   */
  onLoadMore() {
    // Chặn nếu đang load, hoặc hết data, hoặc chưa tìm kiếm
    if (this.isLoadingMore() || !this.hasMoreData() || this.isLoading()) return;

    this.currentPage++;
    this.isLoadingMore.set(true);

    // Gọi API nối đuôi
    this.fetchData(true);
  }

  /**
   * 3. HÀM GỌI API CHUNG
   * @param isAppend: True = Nối thêm (Load More), False = Gán mới (Search)
   */
  private fetchData(isAppend: boolean = false) {
    // Chuẩn bị tham số gửi xuống Service
    const apiParams = {
        ...this.currentParams,
        page: this.currentPage,      // Backend cần hỗ trợ skip/limit hoặc page/pageSize
        page_size: this.pageSize
    };

    this.orderService.getOrders(apiParams).subscribe({
      next: (res: any) => {
        // Lấy mảng data từ response (hỗ trợ cả cấu trúc {data: []} hoặc {data: {data: []}})
        const newData = Array.isArray(res.data) ? res.data : (res.data?.data || []);

        // Kiểm tra nếu dữ liệu trả về ít hơn pageSize -> Đã hết dữ liệu
        if (newData.length < this.pageSize) {
            this.hasMoreData.set(false);
        }

        if (isAppend) {
            // Trường hợp Load More: Nối vào danh sách cũ
            this.orders.update(oldOrders => [...oldOrders, ...newData]);
            this.isLoadingMore.set(false);
        } else {
            // Trường hợp Search mới: Gán đè hoàn toàn
            this.orders.set(newData);
            this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('History API Error:', err);
        // Xử lý lỗi: Tắt loading
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      }
    });
  }
}

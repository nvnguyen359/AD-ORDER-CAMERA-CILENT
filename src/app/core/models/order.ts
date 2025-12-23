export interface Order {
    id: number;
    code: string;
    status: 'packing' | 'packed' | 'shipping' | 'closed' | 'cancelled'; // Cập nhật các status có thể có
    path_avatar?: string;
    path_video?: string;
    order_metadata?: any;
    note?: string;
    camera_id?: number;
    user_id?: number;
    parent_id?: number|null;
    session_id?: string;
    created_at: string;
    start_at?: string;
    closed_at?: string;

    // --- CÁC TRƯỜNG DÙNG CHO UI (Optional) ---
    // Thêm dấu ? để TypeScript hiểu đây là trường không bắt buộc từ DB trả về
    full_avatar_path?: string;
    duration?: string;
    staff_name?: string;
}

export interface OrderResponse {
    code: number;      // Thêm trường này
    mes: string;       // Thêm trường này
    data: Order[];     // Đảm bảo data là mảng Order
    total: number;
    page: number;
    pageSize: number;
}
// ViewModel: Dữ liệu đã tính toán để render UI
export interface OrderGroupViewModel {
  groupId: number;
  displayCode: string;        // Code của đơn cha
  latestStatus: string;       // Status của đơn mới nhất
  latestDate: Date;           // Ngày mới nhất (để sort và hiển thị Started)
  totalItems: number;         // Tổng số đơn con
  durationText: string;       // Time = Close(max) - Created(min)

  items: Order[];             // Danh sách đơn con
  isExpanded: boolean;        // Trạng thái đóng mở
  hasVideo: boolean;          // Check xem nhóm có video không
}

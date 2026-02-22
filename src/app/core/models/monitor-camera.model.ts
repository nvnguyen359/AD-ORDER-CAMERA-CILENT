// app/core/models/monitor-camera.model.ts (hoặc file chứa type của bạn)

export type CameraStatus = 'online' | 'offline' | 'error';
export type OrderStatus = 'IDLE' | 'PACKING' | 'ISSUE';
export type CameraMode = 'security' | 'scan' | 'both' | 'normal';

export interface OrderInfo {
  code: string; // Mã vận đơn (VD: SPX_123)
  staffName: string; // Tên nhân viên đóng gói
  avatarUrl?: string; // Ảnh đại diện nhân viên
  productImage?: string; // Ảnh sản phẩm (snapshot lúc tạo đơn)
  startTime: Date; // Thời gian bắt đầu
  note?: string; // Ghi chú (Hàng dễ vỡ...)
  status: OrderStatus | string; // [FIX] Tận dụng type OrderStatus cho chặt chẽ
}

export interface AiBox {
  box: [number, number, number, number]; // [x, y, w, h]
  type: string;
  label?: string;
  code?: string;
}

export interface MonitorCamera {
  id: number;
  name: string;
  display_name?: string | null;
  device_id: string;

  // [FIX] Sửa thành optional (?) vì Camera IP có thể không có device_path/os_index
  device_path?: string | null;
  os_index?: number | null;

  // [FIX QUAN TRỌNG] Bổ sung rtsp_url để sửa triệt để lỗi TS2339 và TS2353 ở Component
  rtsp_url?: string | null;

  unique_id: string;
  status: string; // Có thể dùng CameraStatus nếu Backend trả về đúng chữ online/offline/error
  is_connected: number | boolean;

  // [FIX] Thêm 'DISCONNECTED' vì trong component có logic set trạng thái này khi ngắt kết nối
  recording_state?: 'IDLE' | 'AUTO' | 'MANUAL' | 'DISCONNECTED';

  active_order_code?: string | null;
  created_at?: string;
}

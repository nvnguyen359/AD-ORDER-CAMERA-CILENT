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
  status: string; // Trạng thái hiển thị (Đang xử lý...)
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
  device_path: string;
  unique_id: string;
  os_index: number;
  status: string;
  is_connected: number | boolean;
  recording_state: 'IDLE' | 'AUTO' | 'MANUAL';
  active_order_code?: string | null;
  created_at?: string;
}

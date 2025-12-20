export type CameraStatus = 'online' | 'offline' | 'error';
export type OrderStatus = 'IDLE' | 'PACKING' | 'ISSUE';
export type CameraMode = 'security' | 'scan' | 'both' | 'normal';

export interface OrderInfo {
  code: string;           // Mã vận đơn (VD: SPX_123)
  staffName: string;      // Tên nhân viên đóng gói
  avatarUrl?: string;     // Ảnh đại diện nhân viên
  productImage?: string;  // Ảnh sản phẩm (snapshot lúc tạo đơn)
  startTime: Date;        // Thời gian bắt đầu
  note?: string;          // Ghi chú (Hàng dễ vỡ...)
  status: string;         // Trạng thái hiển thị (Đang xử lý...)
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
  rtspUrl: string;

  // Trạng thái kết nối & Stream
  status: CameraStatus;
  mode: CameraMode;
  currentImageStr: string | null; // Base64 stream
  aiMetadata: AiBox[];
  showAiBox: boolean;

  // Trạng thái Đơn hàng (Nghiệp vụ)
  isRecording: boolean;
  orderStatus: OrderStatus;
  currentOrder: OrderInfo | null;

  // UI Display
  displayDuration: string; // Thời gian đếm ngược/trôi qua (00:05)
}

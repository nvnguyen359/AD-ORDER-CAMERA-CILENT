export type CameraStatus = 'online' | 'offline' | 'error';
export type OrderStatus = 'IDLE' | 'PACKING' | 'ISSUE';
export type CameraMode = 'security' | 'scan' | 'both' | 'normal';

export interface AiBox {
  box: [number, number, number, number]; // [x, y, w, h]
  type: string;
  label?: string;
  code?: string;
}

export interface OrderInfo {
  code: string;           // Mã vận đơn (VD: SPX_123)
  staffName: string;      // Tên nhân viên
  avatarUrl?: string;     // Avatar nhân viên
  productImage?: string;  // Ảnh sản phẩm (snapshot lúc tạo đơn)
  startTime: string;      // ISO String
  note?: string;          // Ghi chú (Hàng dễ vỡ...)
}

export interface CameraStream {
  id: number;
  name: string;
  rtspUrl?: string;

  // Trạng thái kỹ thuật
  status: CameraStatus;
  mode: CameraMode;

  // Dữ liệu luồng (Real-time)
  currentImageStr?: string; // Base64
  aiMetadata?: AiBox[];
  showAiBox: boolean;

  // Trạng thái nghiệp vụ (Order Logic)
  isRecording: boolean;
  orderStatus: OrderStatus;
  currentOrder?: OrderInfo | null;

  // UI Display (Frontend only)
  displayDuration?: string; // 00:05
  isLoading?: boolean;      // Hiệu ứng xoay khi đang connect
}

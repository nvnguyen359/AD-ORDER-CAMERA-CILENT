// core/models/order.model.ts

export type OrderStatus = 'PACKING' | 'PACKED' | 'ISSUE' | 'MERGED';

export interface Order {
  parent_id: number | boolean | undefined;
  start_at(start_at: any, closed_at: string | undefined): number;
  id: number;
  code: string;
  status: OrderStatus;
  // Media paths (Map theo DB schema của bạn)
  path_avatar?: string;
  path_video?: string;

  note?: string;

  // Metadata
  created_at: string; // Backend trả về chuỗi ISO
  closed_at?: string;
  // Info
  total_amount: number;
  packer_name?: string;
}

// Interface khớp với return response_success(...) của Backend
export interface OrderResponse {
  code: number;
  data: Order[];
  total: number;
  page: number;
  pageSize: number; // Backend bạn trả về key này ở dòng cuối list_orders
}

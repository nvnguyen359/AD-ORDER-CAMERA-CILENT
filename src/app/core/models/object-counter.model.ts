// src/app/core/models/object-counter.model.ts

export type StrategyType = 'table_zone' | 'line_crossing';

export interface BoundingBox {
  box: [number, number, number, number]; // [x, y, w, h] (tỉ lệ 0.0 - 1.0)
  label?: string;
  conf?: number;
  id?: number;
  center?: [number, number];
}

// Kết quả trả về từ API phân tích ảnh/video
export interface AnalysisResult {
  // Trường hợp ảnh
  filename?: string;
  count?: number;
  items?: BoundingBox[];
  processed_image?: string; // Base64 ảnh đã vẽ khung

  // Trường hợp Video
  video_path?: string;
  total_duration_sec?: number;
  max_items_on_table?: number;
  avg_items_on_table?: number;
  timeline?: { timestamp: number; count: number }[];
}

// Payload Socket
export interface StreamPayload {
  camera_id: number;
  image: string; // Base64
  metadata: {
    strategy: StrategyType;
    count?: number;
    items?: BoundingBox[];
    timestamp: number;
  };
}

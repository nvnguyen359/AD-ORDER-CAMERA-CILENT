// src/app/core/models/monitor.model.ts

export type CameraStatus = 'IDLE' | 'RECORDING' | 'DISCONNECTED';

export interface OrderInfo {
    code: string;           // Mã đơn: SPX_123...
    startTime: string;      // Thời gian bắt đầu (ISO String)
    avatarUrl?: string;     // Ảnh chụp lúc 5s (URL ảnh thật hoặc placeholder)
    note?: string;          // Ghi chú
}

export interface Camera {
    id: number;
    name: string;
    rtspUrl: string;
    status: CameraStatus;
    currentOrder?: OrderInfo; // Chỉ có dữ liệu này khi status = RECORDING
}
import { Component, EventEmitter, Output, signal, model, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ZXing Imports
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';

// PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-qr-scan-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ZXingScannerModule,
    DialogModule,
    ButtonModule
  ],
  templateUrl: './qr-scan-dialog.component.html',
  styleUrls: ['./qr-scan-dialog.component.scss']
})
export class QrScanDialogComponent {
  // Input Model (Signal) từ Angular 17+
  visible = model<boolean>(false);
  @Output() scanSuccess = new EventEmitter<string>();

  private messageService = inject(MessageService);

  allowedFormats = [
    BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODABAR, BarcodeFormat.ITF
  ];

  permissionState = signal<boolean | null>(null);
  hasDevices = signal<boolean>(false);
  availableDevices = signal<MediaDeviceInfo[]>([]);
  currentDevice = signal<MediaDeviceInfo | undefined>(undefined);
  isScanning = signal<boolean>(true); // Trạng thái để debounce

  // Debounce: Thời gian chờ giữa 2 lần quét (ms)
  private readonly SCAN_DEBOUNCE_MS = 2000;
  private lastScanTime = 0;

  // Biến check môi trường an toàn
  isSecureContext = window.isSecureContext;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetState();
        // [FIX] Nếu không tìm thấy thiết bị sau 1s, thử xin quyền thủ công
        setTimeout(() => {
            if (!this.hasDevices()) {
                this.requestPermissionNative();
            }
        }, 1000);
      }
    });
  }

  resetState() {
    this.permissionState.set(null);
    this.hasDevices.set(false);
    this.isScanning.set(true);
    this.availableDevices.set([]);
    this.lastScanTime = 0; // Reset debounce time
  }

  // [FIX] Hàm xin quyền thủ công (Native API)
  async requestPermissionNative() {
    console.log('Đang thử xin quyền Camera thủ công...');
    try {
        // Yêu cầu luồng video để trình duyệt hiện popup hỏi quyền
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });

        // Nếu được quyền, tắt luồng ngay để nhường cho Zxing
        stream.getTracks().forEach(track => track.stop());

        console.log('Đã cấp quyền! Đang tải lại thiết bị...');
        this.permissionState.set(true);

        // Gọi lại hàm enumerateDevices để Zxing cập nhật
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            this.onCamerasFound(videoDevices);
        });

    } catch (err) {
        console.error('Xin quyền thất bại:', err);
        this.permissionState.set(false);
        this.messageService.add({severity: 'error', summary: 'Lỗi Quyền', detail: 'Vui lòng cấp quyền Camera'});
    }
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    console.log('Cameras found:', devices);

    // Lọc chỉ lấy videoinput (camera)
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    if (!videoDevices || videoDevices.length === 0) {
        this.hasDevices.set(false);
        return;
    }

    this.hasDevices.set(true);
    this.permissionState.set(true);
    this.availableDevices.set(videoDevices);

    // Tự động chọn camera nếu chưa chọn
    if (!this.currentDevice()) {
        const backCamera = videoDevices.find(device => /back|rear|environment/gi.test(device.label));
        if (backCamera) {
          this.currentDevice.set(backCamera);
        } else {
          this.currentDevice.set(videoDevices[0]);
        }
    }
  }

  onDeviceSelectChange(device: any) {
      console.log('User switched to:', device.label);
      this.currentDevice.set(device);
  }

  onPermissionResponse(permission: boolean): void {
    console.log('Zxing Permission Response:', permission);
    this.permissionState.set(permission);
    if (!permission) this.hasDevices.set(false);
  }

  onScanSuccess(resultString: string): void {
    if (!resultString) return;

    const now = Date.now();
    // Chặn nếu quét quá nhanh (Debounce)
    if (now - this.lastScanTime < this.SCAN_DEBOUNCE_MS) {
        return;
    }
    this.lastScanTime = now;

    console.log('📷 QR Scanned:', resultString);

    // Phát tiếng bíp
    this.playBeep();

    // Tắt scan tạm thời
    this.isScanning.set(false);

    // Gửi kết quả
    this.scanSuccess.emit(resultString);

    // Đóng dialog sau 0.3s
    setTimeout(() => this.closeDialog(), 300);
  }

  private playBeep() {
    const audio = new Audio('assets/sounds/beep.mp3');
    audio.play().catch(() => {});
  }

  closeDialog() {
    this.visible.set(false);
  }

  onHideDialog() {
    this.isScanning.set(false);
  }

  retryScan() {
      // Gọi hàm native để ép trình duyệt hỏi lại
      this.requestPermissionNative();
  }
}

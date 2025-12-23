import { Component, EventEmitter, Output, ViewChild, signal, model, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZXingScannerComponent, ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-qr-scan-dialog',
  standalone: true,
  imports: [CommonModule, ZXingScannerModule, DialogModule, ButtonModule],
  templateUrl: './qr-scan-dialog.component.html',
  styleUrls: ['./qr-scan-dialog.component.scss']
})
export class QrScanDialogComponent {
  visible = model<boolean>(false);
  @Output() scanSuccess = new EventEmitter<string>();

  allowedFormats = [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.EAN_13];

  // State
  // null: đang check, true: ok, false: bị từ chối/lỗi
  permissionState = signal<boolean | null>(null);
  hasDevices = signal<boolean>(false);
  currentDevice = signal<MediaDeviceInfo | undefined>(undefined);

  // Biến cờ để block sau khi quét xong
  isScanning = signal<boolean>(true);

  constructor() {
    // Effect: Khi dialog mở lại, reset các trạng thái để Scanner khởi động lại từ đầu
    effect(() => {
      if (this.visible()) {
        this.resetState();
      }
    });
  }

  resetState() {
    this.permissionState.set(null);
    this.hasDevices.set(false);
    this.isScanning.set(true);
    // Không reset currentDevice ngay để tránh flicker nếu đã chọn được cam trước đó
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.hasDevices.set(true);
    // Ưu tiên camera sau
    const backCamera = devices.find(device => /back|rear|environment/gi.test(device.label));
    if (backCamera) {
      this.currentDevice.set(backCamera);
    } else {
      this.currentDevice.set(devices[devices.length - 1]);
    }
  }

  onPermissionResponse(permission: boolean): void {
    console.log('Permission response:', permission);
    this.permissionState.set(permission);

    // Nếu permission = false, có thể do "NotAllowedError" hoặc do camera đang bị chiếm dụng
    if (!permission) {
        this.hasDevices.set(false);
    }
  }

  // Bắt lỗi cụ thể (Ví dụ: NotAllowedError)
  onScanError(error: any) {
    console.error('Scan Error:', error);
    // Nếu lỗi liên quan đến quyền hoặc thiết bị
    if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
        this.permissionState.set(false);
    }
  }

  onScanSuccess(resultString: string): void {
    if (!this.isScanning() || !resultString) return;

    this.playBeep();
    this.isScanning.set(false);
    this.scanSuccess.emit(resultString);
    this.closeDialog();
  }

  private playBeep() {
    // Đảm bảo user đã tương tác với trang trước đó thì audio mới chạy được
    const audio = new Audio('assets/sounds/beep.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
  }

  closeDialog() {
    this.visible.set(false);
  }

  // Khi đóng dialog (nút X hoặc click ra ngoài)
  onHideDialog() {
    // Khi visible = false, @if trong HTML sẽ remove zxing-scanner component
    // Điều này tự động gọi ngOnDestroy của thư viện -> Stop tracks camera
    this.isScanning.set(false);
  }

  retryScan() {
      // Reset lại để thử init lại scanner
      this.resetState();
      // Mẹo: Toggle visible nhanh để force re-render component
      const current = this.visible();
      this.visible.set(false);
      setTimeout(() => this.visible.set(true), 100);
  }
}

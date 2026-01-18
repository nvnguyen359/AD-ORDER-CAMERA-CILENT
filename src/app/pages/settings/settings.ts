import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    Select
  ],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
  providers: [MessageService]
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  private messageService = inject(MessageService);

  settingForm: FormGroup;
  cameras: any[] = [];
  isLoading = false;

  resolutions = [
    { label: 'HD (1280 x 720) - 16:9 [Khuyên dùng]', value: '1280x720' },
    { label: 'Full HD (1920 x 1080) - 16:9', value: '1920x1080' },
    { label: 'VGA (640 x 480) - 4:3 [Máy cũ]', value: '640x480' },
    { label: 'SVGA (800 x 600) - 4:3', value: '800x600' }
  ];

  aiOptions = [
    { label: 'Thấp (0.3) - Nhạy, dễ bắt nhầm', value: 0.3 },
    { label: 'Trung bình (0.5) - Khuyên dùng', value: 0.5 },
    { label: 'Cao (0.7) - Chính xác', value: 0.7 }, // [MẶC ĐỊNH MỚI]
    { label: 'Rất cao (0.85) - Rất chặt chẽ', value: 0.85 }
  ];

  timeoutOptions = [
    { label: '30 giây (Nhanh)', value: 30 },
    { label: '1 phút (Tiêu chuẩn)', value: 60 }, // [MẶC ĐỊNH MỚI]
    { label: '1 phút 30 giây', value: 90 },
    { label: '2 phút', value: 120 },
    { label: '5 phút', value: 300 },
    { label: '10 phút', value: 600 },
    { label: '30 phút (Rất lâu)', value: 1800 }
  ];

  constructor() {
    // [CẬP NHẬT] Set mặc định: AI=0.7, Timeout=60s
    this.settingForm = this.fb.group({
      save_media: ['OC-media', Validators.required],
      resolution: ['1280x720', Validators.required],
      ai_confidence: [0.7, Validators.required],
      timeout_no_human: [60, Validators.required],
      work_end_time: ['18:30', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.settingsService.getCameras().subscribe(cams => this.cameras = cams);

    this.settingsService.getSettings().subscribe({
      next: (data: any) => {
        const w = data['camera_width'] || 1280;
        const h = data['camera_height'] || 720;
        const resKey = `${w}x${h}`;

        // Check Resolution Custom
        const existsRes = this.resolutions.some(r => r.value === resKey);
        if (!existsRes) {
          this.resolutions.push({ label: `Tùy chỉnh (${w} x ${h})`, value: resKey });
        }

        // [CẬP NHẬT] Check Timeout Custom & Mặc định là 60 nếu DB chưa có
        const dbTimeout = Number(data['timeout_no_human']) || 60;
        const existsTimeout = this.timeoutOptions.some(t => t.value === dbTimeout);
        if (!existsTimeout) {
          this.timeoutOptions.push({ label: `${dbTimeout} giây (Tùy chỉnh)`, value: dbTimeout });
          this.timeoutOptions.sort((a, b) => a.value - b.value);
        }

        // [CẬP NHẬT] Patch value với fallback mới (AI=0.7)
        this.settingForm.patchValue({
          save_media: data['save_media'],
          resolution: resKey,
          ai_confidence: Number(data['ai_confidence']) || 0.7, // Mặc định 0.7 nếu DB null
          timeout_no_human: dbTimeout,
          work_end_time: data['work_end_time'] || '18:30'
        });
        this.isLoading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được cấu hình' });
        this.isLoading = false;
      }
    });
  }

  saveSettings() {
    if (this.settingForm.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng kiểm tra lại dữ liệu' });
      return;
    }

    this.isLoading = true;
    const formVal = this.settingForm.value;
    const [w, h] = formVal.resolution.split('x');

    const payload = {
      save_media: formVal.save_media,
      ai_confidence: formVal.ai_confidence,
      camera_width: Number(w),
      camera_height: Number(h),
      timeout_no_human: formVal.timeout_no_human,
      work_end_time: formVal.work_end_time
    };

    this.settingsService.updateSettings(payload).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Đã lưu', detail: 'Cập nhật thành công!', life: 2000 });
        this.isLoading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Lưu thất bại' });
        this.isLoading = false;
      }
    });
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select'; 
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
    SelectModule
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

  // Cấu hình các tùy chọn hiển thị
  resolutions = [
    { label: '🚀 FWVGA (854 x 480) - Siêu mượt [Khuyên dùng Pi 3]', value: '854x480' },
    { label: 'HD (1280 x 720) - 16:9 [Tiêu chuẩn]', value: '1280x720' },
    { label: 'VGA (640 x 480) - 4:3 [Nhẹ]', value: '640x480' },
    { label: 'SVGA (800 x 600) - 4:3', value: '800x600' },
    { label: 'Full HD (1920 x 1080) - [Nặng]', value: '1920x1080' }
  ];

  aiOptions = [
    { label: 'Thấp (0.3) - Nhạy, dễ bắt nhầm', value: 0.3 },
    { label: 'Trung bình (0.5) - Khuyên dùng', value: 0.5 },
    { label: 'Cao (0.7) - Chính xác', value: 0.7 },
    { label: 'Rất cao (0.85) - Rất chặt chẽ', value: 0.85 }
  ];

  timeoutOptions = [
    { label: '30 giây (Nhanh)', value: 30 },
    { label: '1 phút (Tiêu chuẩn)', value: 60 },
    { label: '2 phút', value: 120 },
    { label: '5 phút', value: 300 },
    { label: '10 phút', value: 600 }
  ];

  fpsOptions = [
    { label: '10 FPS (Tối ưu lưu trữ)', value: 10.0 },
    { label: '15 FPS (Mượt mà)', value: 15.0 },
    { label: '20 FPS (Tiêu chuẩn)', value: 20.0 },
    { label: '25 FPS (Cao - Tốn dung lượng)', value: 25.0 }
  ];

  fpsViewOptions = [
    { label: '10 FPS (Tiết kiệm CPU)', value: 10.0 },
    { label: '15 FPS (Khuyên dùng)', value: 15.0 },
    { label: '20 FPS (Mượt)', value: 20.0 },
    { label: '25 FPS (Rất mượt - Tốn CPU)', value: 25.0 }
  ];

  constructor() {
    this.settingForm = this.fb.group({
      save_media: ['app/media', Validators.required],
      resolution: ['854x480', Validators.required],
      ai_confidence: [0.5, Validators.required],
      timeout_no_human: [60, Validators.required],
      work_end_time: ['18:30', Validators.required],
      read_end_order: [5, Validators.required],
      perf_record_fps: [10.0, Validators.required],
      perf_view_fps: [15.0, Validators.required],
      perf_ai_interval: [12, Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    // Load danh sách camera (nếu cần hiển thị thông tin bổ sung)
    this.settingsService.getCameras().subscribe({
        next: (cams) => this.cameras = cams,
        error: () => console.warn("Không tải được danh sách camera")
    });

    this.settingsService.getSettings().subscribe({
      next: (data: any) => {
        // Xử lý logic hiển thị Resolution từ camera_width và camera_height
        const w = data['camera_width'] || 854;
        const h = data['camera_height'] || 480;
        const resKey = `${w}x${h}`;

        const existsRes = this.resolutions.some(r => r.value === resKey);
        if (!existsRes) {
          this.resolutions.push({ label: `Tùy chỉnh (${w} x ${h})`, value: resKey });
        }

        // Cập nhật giá trị vào Form
        this.settingForm.patchValue({
          save_media: data['save_media'] || 'app/media',
          resolution: resKey,
          ai_confidence: Number(data['ai_confidence']) || 0.5,
          timeout_no_human: Number(data['timeout_no_human']) || 60,
          work_end_time: data['work_end_time'] || '18:30',
          read_end_order: Number(data['read_end_order']) || 5,
          perf_record_fps: Number(data['perf_record_fps']) || 10.0,
          perf_view_fps: Number(data['perf_view_fps']) || 15.0,
          perf_ai_interval: Number(data['perf_ai_interval']) || 12,
        });

        this.isLoading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được cấu hình từ Server' });
        this.isLoading = false;
      }
    });
  }

  saveSettings() {
    if (this.settingForm.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    this.isLoading = true;
    const formVal = this.settingForm.value;
    const [w, h] = formVal.resolution.split('x');

    /**
     * FIX: TẠO PAYLOAD PHẲNG (FLAT JSON)
     * Không bọc trong object "settings: {}" để Backend nhận diện được từng Key
     */
    const payload = {
      save_media: formVal.save_media,
      camera_width: String(w),
      camera_height: String(h),
      ai_confidence: String(formVal.ai_confidence),
      timeout_no_human: String(formVal.timeout_no_human),
      work_end_time: String(formVal.work_end_time),
      read_end_order: String(formVal.read_end_order),
      perf_record_fps: String(formVal.perf_record_fps),
      perf_view_fps: String(formVal.perf_view_fps),
      perf_ai_interval: String(formVal.perf_ai_interval)
    };

    console.log("🚀 Sending Payload:", payload);

    this.settingsService.updateSettings(payload).subscribe({
      next: (res) => {
        this.messageService.add({ 
          severity: 'success', 
          summary: 'Thành công', 
          detail: 'Đã lưu cấu hình. Hãy khởi động lại dịch vụ Camera để áp dụng.', 
          life: 4000 
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error("❌ Save Error:", err);
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể lưu cấu hình xuống Database' });
        this.isLoading = false;
      }
    });
  }
}
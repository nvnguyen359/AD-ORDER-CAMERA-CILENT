import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SliderModule } from 'primeng/slider';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { FluidModule } from 'primeng/fluid';

import { forkJoin, filter } from 'rxjs';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AutoCompleteModule,
    ButtonModule,
    TabsModule,
    CardModule,
    InputTextModule,
    InputNumberModule,
    ToggleSwitchModule,
    SliderModule,
    CheckboxModule,
    ToastModule,
    TooltipModule,
    FluidModule
  ],
  providers: [MessageService],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss']
})
export class SettingsComponent implements OnInit {
  settingsForm!: FormGroup;
  isLoading = true;

  availableCameras: any[] = [];
  filteredCameras: any[] = [];

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
  }

  // ===================== FORM =====================
  private initForm(): void {
    this.settingsForm = this.fb.group({
      aiConfig: this.fb.group({
        selectedCameraObj: [null],
        confidenceThreshold: [0.65],
        debugMode: [true],
        detectPerson: [true],
        detectQR: [true],
        enableROI: [false]
      }),
      operationConfig: this.fb.group({
        idleTimeoutSeconds: [30], // Giá trị mặc định client
        autoRecordOnQR: [true],
        autoSnapshot: [true],
        soundAlerts: [false]
      }),
      storageConfig: this.fb.group({
        storagePath: ['D:/Images'],
        retentionDays: [30],
        autoCleanup: [true]
      }),
      times: this.fb.group({
        open: ['08:00', Validators.required],
        close: ['17:30', Validators.required]
      })
    });
  }

  // ===================== LOAD DATA (Đã Fix) =====================
  private loadInitialData(): void {
    this.isLoading = true;

    forkJoin({
      cameras: this.settingsService.getCameras(),
      settings: this.settingsService.getSettings() // Service đã map .data nên ở đây nhận đúng SystemConfig
    })
      .pipe(filter(({ cameras }) => Array.isArray(cameras)))
      .subscribe({
        next: ({ cameras, settings }) => {
          this.availableCameras = cameras;
          console.log('Settings Loaded:', settings);

          if (settings) {
            // 1. Map Camera Object từ ID
            let foundCamera = null;
            if (settings.aiConfig && settings.aiConfig.selectedCameraId !== null) {
               // Lưu ý: Cần ép kiểu về String hoặc Number cho chắc chắn khi so sánh
               const savedId = settings.aiConfig.selectedCameraId;
               foundCamera = this.availableCameras.find(c => c.value == savedId) ?? null;
            }

            // 2. Patch Value
            // Do cấu trúc form khớp hoàn toàn với JSON (camelCase), ta patch trực tiếp
            this.settingsForm.patchValue({
              ...settings,
              aiConfig: {
                ...settings.aiConfig,
                selectedCameraObj: foundCamera
              }
            });
          }

          this.isLoading = false;
        },
        error: err => {
          console.error('Load settings error:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không tải được cấu hình hệ thống'
          });
          this.isLoading = false;
        }
      });
  }

  // ===================== AUTOCOMPLETE =====================
  filterCameras(event: AutoCompleteCompleteEvent): void {
    const query = event.query?.toLowerCase() ?? '';
    this.filteredCameras = this.availableCameras.filter(cam =>
      cam.label?.toLowerCase().includes(query)
    );
  }

  // ===================== SUBMIT =====================
  onSubmit(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng kiểm tra lại các trường bắt buộc' });
      return;
    }

    this.isLoading = true;
    const formValue = this.settingsForm.value;
    const selectedCamera = formValue.aiConfig.selectedCameraObj;

    // Convert data (Nếu Backend yêu cầu snake_case thì map lại ở đây)
    // Dựa vào code python bạn gửi trước đó, bạn đã dùng alias="camelCase"
    // nên Backend nhận JSON camelCase là OK. Tuy nhiên, nếu Backend vẫn dùng snake_case ở Model nhận vào,
    // ta nên gửi đúng format mà Service/Backend mong đợi.
    // Dưới đây là map về snake_case theo đúng `setting_crud.py` cũ:

    const payload: any = {
      // AI Config
      aiConfig: {
        ...formValue.aiConfig,
        selectedCameraId: selectedCamera ? selectedCamera.value : null,
      },
      // Các phần khác giữ nguyên (vì formValue đã là camelCase giống data mong đợi)
      operationConfig: formValue.operationConfig,
      storageConfig: formValue.storageConfig,
      times: formValue.times
    };

    // Xóa field ảo không cần gửi lên
    delete payload.aiConfig.selectedCameraObj;

    this.settingsService.saveSettings(payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Thành công', detail: 'Đã lưu cấu hình' });
        this.isLoading = false;
      },
      error: err => {
        console.error('Save settings error:', err);
        this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Lưu thất bại' });
        this.isLoading = false;
      }
    });
  }

  mockDrawROI(): void {
    this.messageService.add({ severity: 'info', summary: 'Coming Soon', detail: 'Chức năng đang phát triển' });
  }
}

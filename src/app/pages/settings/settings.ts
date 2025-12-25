import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG Imports (Giữ nguyên như file cũ của bạn)
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

import { SettingsService, SystemConfig } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    AutoCompleteModule, ButtonModule, TabsModule, CardModule,
    InputTextModule, InputNumberModule, ToggleSwitchModule,
    SliderModule, CheckboxModule, ToastModule, TooltipModule, FluidModule
  ],
  providers: [MessageService],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss']
})
export class SettingsComponent implements OnInit {
  settingsForm!: FormGroup;

  // FIX NG0100: Set mặc định là TRUE.
  // Vì vào trang là load dữ liệu ngay, trạng thái đầu tiên phải là đang load.
  isLoading = true;

  availableCameras: any[] = [];
  filteredCameras: any[] = [];

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    // Không cần setTimeout nữa vì isLoading đã true từ đầu
    this.loadDataSequence();
  }

  initForm() {
    this.settingsForm = this.fb.group({
      aiConfig: this.fb.group({
        selectedCameraObj: [null, Validators.required],
        confidenceThreshold: [0.65],
        debugMode: [true],
        detectPerson: [true],
        detectQR: [true],
        enableROI: [false]
      }),
      operationConfig: this.fb.group({
        idleTimeoutSeconds: [900],
        autoRecordOnQR: [true],
        autoSnapshot: [true],
        soundAlerts: [false]
      }),
      storageConfig: this.fb.group({
        storagePath: ['D:/OC_System_Data'],
        retentionDays: [30],
        autoCleanup: [true]
      })
    });
  }

  filterCameras(event: AutoCompleteCompleteEvent) {
    const query = event.query.toLowerCase();
    this.filteredCameras = this.availableCameras.filter(cam =>
      cam.label.toLowerCase().includes(query)
    );
  }

  loadDataSequence() {
    // Không set isLoading = true ở đây nữa để tránh xung đột

    // 1. Lấy danh sách Camera
    this.settingsService.getCameras().subscribe({
      next: (cams) => {
        this.availableCameras = cams;

        // 2. Lấy Settings
        this.settingsService.getSettings().subscribe({
          next: (config) => {
            if (config) {
              const savedId = config.aiConfig.selectedCameraId;
              const foundCam = this.availableCameras.find(c => c.value === savedId);

              this.settingsForm.patchValue({
                ...config,
                aiConfig: {
                  ...config.aiConfig,
                  selectedCameraObj: foundCam || null
                }
              });
            }
            this.stopLoading(); // Tắt loading an toàn
          },
          error: (err) => {
            console.error('Lỗi API Settings:', err);
            this.stopLoading();
          }
        });
      },
      error: (err) => {
        console.error('Lỗi API Cameras:', err);
        this.messageService.add({severity:'error', summary:'Lỗi', detail:'Không tải được Camera'});
        this.stopLoading();
      }
    });
  }

  onSubmit() {
    if (this.settingsForm.invalid) return;

    this.isLoading = true; // Bấm nút thì set true thủ công
    const formVal = this.settingsForm.value;
    const selectedObj = formVal.aiConfig.selectedCameraObj;

    const configToSave: SystemConfig = {
      ...formVal,
      aiConfig: {
        ...formVal.aiConfig,
        selectedCameraId: selectedObj ? selectedObj.value : null
      }
    };

    delete (configToSave.aiConfig as any).selectedCameraObj;

    this.settingsService.saveSettings(configToSave).subscribe({
      next: () => {
        this.messageService.add({severity:'success', summary:'Thành công', detail:'Đã lưu!'});
        this.stopLoading();
      },
      error: () => {
        this.messageService.add({severity:'error', summary:'Lỗi', detail:'Lưu thất bại'});
        this.stopLoading();
      }
    });
  }

  // Hàm Helper để tắt loading và ép Angular update view
  stopLoading() {
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  mockDrawROI() {
    this.messageService.add({severity:'info', summary:'Coming Soon', detail:'Chức năng đang phát triển'});
  }
}

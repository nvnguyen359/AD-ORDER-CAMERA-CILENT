import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { KnobModule } from 'primeng/knob';
import { TagModule } from 'primeng/tag';

import { SystemStats } from '../../core/models/system-stats.model';
import { SocketService } from '../../core/services/socket.service';

@Component({
  selector: 'app-system-monitor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, 
    ProgressBarModule, KnobModule, TagModule
  ],
  templateUrl: './system-monitor.component.html',
  styleUrls: ['./system-monitor.component.scss']
})
export class SystemMonitorComponent {
  private socketService = inject(SocketService);
  stats = signal<SystemStats | null>(null);

  constructor() {
   this.socketService.onEvent<SystemStats>('SYSTEM_STATS').subscribe(data => {
    // Làm tròn số trước khi set vào signal
    const roundedData = {
      ...data,
      cpu_overall: Math.round(data.cpu_overall), // Ví dụ: 15.7 -> 16
      ram_percent: Math.round(data.ram_percent)  // Ví dụ: 40.2 -> 40
    };
    this.stats.set(roundedData);
  });
  }

  // Chuyển đổi MB sang GB với 1 số thập phân
  toGB(mb: number): number {
    return parseFloat((mb / 1024).toFixed(0));
  }

  formatRAM(usedMb: number): string {
    const gb = usedMb / 1024;
    return gb.toFixed(0); // Lấy 1 số thập phân
  }

  getTempSeverity(temp: number) {
    if (temp === 0) return 'info';
    if (temp > 75) return 'danger';
    if (temp > 60) return 'warn';
    return 'success';
  }

  formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
}
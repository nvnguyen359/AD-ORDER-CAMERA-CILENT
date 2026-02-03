import { Component, signal, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { KnobModule } from 'primeng/knob';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

import { SystemStats } from '../../core/models/system-stats.model';
import { SocketService } from '../../core/services/socket.service';

@Component({
  selector: 'app-system-monitor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule,
    ProgressBarModule, KnobModule, TagModule,
    DialogModule, TooltipModule
  ],
  templateUrl: './system-monitor.component.html',
  styleUrls: ['./system-monitor.component.scss']
})
export class SystemMonitorComponent {
  @Input() displayMode: 'full' | 'widget' | 'floating' | 'simple' = 'full';
  @Input() layout: 'row' | 'column' = 'row';
  @Input() containerClass: string = '';

  private socketService = inject(SocketService);
  stats = signal<SystemStats | null>(null);

  showDetailDialog = false;
  isFloatingExpanded = false;

  constructor() {
   this.socketService.onEvent<SystemStats>('SYSTEM_STATS').subscribe(data => {
    const roundedData = {
      ...data,
      cpu_overall: Math.round(data.cpu_overall),
      ram_percent: Math.round(data.ram_percent)
    };
    this.stats.set(roundedData);
   });
  }

  openDetail() {
    this.showDetailDialog = true;
    this.isFloatingExpanded = false;
  }

  toggleFloating(event: Event) {
    event.stopPropagation();
    this.isFloatingExpanded = !this.isFloatingExpanded;
  }

  // [NEW] Lấy class màu nền cho nút tròn FAB
  getTempBgClass(temp: number): string {
    if (temp > 75) return 'bg-danger pulse-animation'; // Đỏ + Nhấp nháy
    if (temp > 60) return 'bg-warn';   // Vàng cam
    return 'bg-ok';                    // Xanh lá
  }

  // Helpers cũ
  getTempColorClass(temp: number): string {
    if (temp > 75) return 'temp-danger';
    if (temp > 60) return 'temp-warn';
    return 'temp-ok';
  }

  getTempSeverity(temp: number) {
    if (temp > 75) return 'danger';
    if (temp > 60) return 'warn';
    return 'success';
  }

  toGB(mb: number): number { return parseFloat((mb / 1024).toFixed(0)); }
  formatRAM(usedMb: number): string { return (usedMb / 1024).toFixed(1); }
  formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
}

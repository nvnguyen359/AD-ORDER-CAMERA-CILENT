import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AnalysisResult } from '../../core/models/object-counter.model';

@Component({
  selector: 'app-ai-analysis-dialog',
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './ai-analysis-dialog.component.html',
  styleUrl: './ai-analysis-dialog.component.scss',
  standalone:true
})
export class AiAnalysisDialogComponent {
@Input() visible = false;
  @Input() result: AnalysisResult | null = null;
  @Input() loading = false;
  @Input() headerTitle = "Kết quả phân tích AI";

  @Output() visibleChange = new EventEmitter<boolean>();

  onClose() {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}

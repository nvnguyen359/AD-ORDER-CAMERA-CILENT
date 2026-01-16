import { Directive, ElementRef, Input, OnChanges, SimpleChanges, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appVisualizer]',
  standalone: true
})
export class VisualizerDirective implements OnChanges {
  @Input() metadata: any[] = [];
  @Input() imgWidth: number = 1280;
  @Input() imgHeight: number = 720;
  @Input() mode: string = 'both';

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(el: ElementRef, private renderer: Renderer2) {
    this.canvas = el.nativeElement;
    this.ctx = this.canvas.getContext('2d');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imgWidth'] || changes['imgHeight']) {
      this.renderer.setAttribute(this.canvas, 'width', this.imgWidth.toString());
      this.renderer.setAttribute(this.canvas, 'height', this.imgHeight.toString());
    }
    this.draw();
  }

  private draw() {
    if (!this.ctx || !this.canvas) return;

    // 1. Luôn xóa sạch canvas trước khi vẽ
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.mode === 'NONE' || !this.metadata || this.metadata.length === 0) return;

    // 2. Cấu hình nét vẽ mảnh, đẹp (như dự án cũ)
    this.ctx.lineWidth = 2;
    this.ctx.font = "bold 16px Segoe UI, Arial";
    this.ctx.textBaseline = 'bottom';

    this.metadata.forEach(item => {
      if (!item) return;

      let x, y, w, h;
      if (item.box && Array.isArray(item.box)) {
        [x, y, w, h] = item.box;
      } else {
        x = item.x; y = item.y; w = item.w; h = item.h;
      }

      // 3. Chỉ kiểm tra tính hợp lệ cơ bản, KHÔNG tự ý sửa toạ độ
      if (x === undefined || y === undefined || w <= 0 || h <= 0) return;

      const color = item.color || '#3498db';
      const label = item.label || 'Object';
      const isQR = (color === '#2ecc71') || label.includes('QR');
      const isHuman = (color === '#e74c3c') || label.includes('Human') || label.includes('Person');

      if (this.mode === 'scan' && !isQR) return;
      if (this.mode === 'security' && !isHuman) return;

      // Vẽ Khung
      this.ctx!.strokeStyle = color;
      this.ctx!.beginPath();
      this.ctx!.rect(x, y, w, h);
      this.ctx!.stroke();

      // Tô nền mờ (10%)
      this.ctx!.fillStyle = color;
      this.ctx!.globalAlpha = 0.1;
      this.ctx!.fillRect(x, y, w, h);
      this.ctx!.globalAlpha = 1.0;

      // Vẽ Nhãn
      const textWidth = this.ctx!.measureText(label).width;
      this.ctx!.fillStyle = color;
      this.ctx!.fillRect(x, y - 24, textWidth + 10, 24);

      this.ctx!.fillStyle = '#ffffff';
      this.ctx!.fillText(label, x + 5, y - 5);
    });
  }
}

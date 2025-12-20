import { Directive, ElementRef, Input, OnChanges, SimpleChanges, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appVisualizer]', // Cách dùng: <canvas appVisualizer [metadata]="...">
  standalone: true
})
export class VisualizerDirective implements OnChanges {
  @Input() metadata: any[] = [];
  @Input() imgWidth: number = 0;
  @Input() imgHeight: number = 0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(el: ElementRef, private renderer: Renderer2) {
    this.canvas = el.nativeElement;
    this.ctx = this.canvas.getContext('2d');
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Nếu kích thước ảnh thay đổi -> Resize canvas ngay lập tức
    if (changes['imgWidth'] || changes['imgHeight']) {
        this.resizeCanvas();
    }

    // Nếu có metadata mới -> Vẽ lại
    if (changes['metadata']) {
      this.draw();
    }
  }

  private resizeCanvas() {
    if (this.imgWidth && this.imgHeight) {
        // Set cứng attribute width/height cho canvas để khớp pixel ratio
        this.renderer.setAttribute(this.canvas, 'width', this.imgWidth.toString());
        this.renderer.setAttribute(this.canvas, 'height', this.imgHeight.toString());
    }
  }

  private draw() {
    if (!this.ctx || !this.canvas) return;

    // 1. Xóa trắng
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.metadata || this.metadata.length === 0) return;

    // 2. Cấu hình Font chung
    this.ctx.lineWidth = 3;
    this.ctx.font = "bold 16px Arial";

    // 3. Duyệt và vẽ từng box
    this.metadata.forEach(item => {
        // box = [x, y, w, h]
        const [x, y, w, h] = item.box;
        const type = item.type;

        // --- Logic màu sắc (Copy từ code cũ) ---
        if (type === 'human') {
            this.setCtxStyle('#e74c3c', '#e74c3c'); // Đỏ
            this.ctx?.strokeRect(x, y, w, h);
            this.ctx?.fillText(`👤 ${item.label || 'Person'}`, x, y - 5);
        }
        else if (['QRCODE', 'qr'].includes(type)) {
            this.setCtxStyle('#0b0fee', '#0b0fee'); // Xanh lá/dương đậm
            this.ctx?.strokeRect(x, y, w, h);
            this.ctx?.fillText(`📦 QR: ${item.code || "QR"}`, x, y - 5);
            this.fillTransparent(x, y, w, h);
        }
        else {
            this.setCtxStyle('#cd0ae7', '#cd0ae7'); // Tím
            this.ctx?.strokeRect(x, y, w, h);
            this.ctx?.fillText(`🏷️ [${type}] ${item.code || "Code"}`, x, y - 5);
            this.fillTransparent(x, y, w, h);
        }
    });
  }

  private setCtxStyle(stroke: string, fill: string) {
      if (!this.ctx) return;
      this.ctx.strokeStyle = stroke;
      this.ctx.fillStyle = fill;
  }

  private fillTransparent(x: number, y: number, w: number, h: number) {
      if (!this.ctx) return;
      this.ctx.globalAlpha = 0.2;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.globalAlpha = 1.0;
  }
}

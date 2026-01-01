import { Directive, ElementRef, Input, OnChanges, SimpleChanges, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appVisualizer]',
  standalone: true
})
export class VisualizerDirective implements OnChanges {
  @Input() metadata: any[] = [];
  @Input() imgWidth: number = 0;
  @Input() imgHeight: number = 0;
  @Input() mode: string = 'normal'; // normal | scan | security | both

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(el: ElementRef, private renderer: Renderer2) {
    this.canvas = el.nativeElement;
    this.ctx = this.canvas.getContext('2d');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imgWidth'] || changes['imgHeight']) {
        this.resizeCanvas();
    }
    // Vẽ lại khi bất kỳ dữ liệu nào thay đổi
    if (changes['metadata'] || changes['imgWidth'] || changes['imgHeight'] || changes['mode']) {
      this.draw();
    }
  }

  private resizeCanvas() {
    if (this.imgWidth && this.imgHeight) {
        this.renderer.setAttribute(this.canvas, 'width', this.imgWidth.toString());
        this.renderer.setAttribute(this.canvas, 'height', this.imgHeight.toString());
    }
  }

  private draw() {
    if (!this.ctx || !this.canvas) return;

    // 1. Xóa sạch Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // [LOGIC] Normal -> Không vẽ gì cả
    if (this.mode === 'normal') return;

    if (!this.metadata || this.metadata.length === 0) return;

    this.ctx.lineWidth = 1; // Nét vẽ dày
    this.ctx.font = "bold 16px Arial";

    this.metadata.forEach(item => {
        if (!item) return;

        // Lấy tọa độ
        let x, y, w, h;
        if (item.box && Array.isArray(item.box)) { [x, y, w, h] = item.box; }
        else { x = item.x; y = item.y; w = item.w; h = item.h; }

        if (x === undefined || y === undefined || w === undefined || h === undefined) return;

        // Lấy màu và nhãn
        const color = item.color || '#3498db';
        const label = item.label || 'Object';

        // [FIX QUAN TRỌNG] Nhận diện loại đối tượng dựa trên MÀU SẮC (Chính xác hơn dựa vào tên)
        // Backend: QR = #2ecc71 (Xanh lá), Người = #e74c3c (Đỏ)
        const isQR = (color === '#2ecc71') || label.includes('QR') || label.includes('Code');
        const isHuman = (color === '#e74c3c') || label.includes('Human') || label.includes('Person');

        // [LOGIC LỌC HIỂN THỊ]
        if (this.mode === 'scan' && !isQR) return;         // Scan -> Chỉ hiện QR
        if (this.mode === 'security' && !isHuman) return;  // Security -> Chỉ hiện Người
        // Mode 'both' -> Hiện tất cả

        // --- BẮT ĐẦU VẼ ---
        this.ctx!.strokeStyle = color;
        this.ctx!.fillStyle = color;

        // Nếu là QR Code -> Tô nền mờ
        if (isQR) {
            this.fillTransparent(x, y, w, h, 0.2);
        }

        // Vẽ khung
        this.ctx!.strokeRect(x, y, w, h);

        // Vẽ Nhãn
        const textWidth = this.ctx!.measureText(label).width;
        this.ctx!.fillRect(x, y - 28, textWidth + 14, 28); // Nền chữ

        this.ctx!.fillStyle = '#ffffff';
        this.ctx!.fillText(label, x + 7, y - 8); // Chữ trắng
    });
  }

  private fillTransparent(x: number, y: number, w: number, h: number, alpha: number) {
      if (!this.ctx) return;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.globalAlpha = 1.0;
  }
}

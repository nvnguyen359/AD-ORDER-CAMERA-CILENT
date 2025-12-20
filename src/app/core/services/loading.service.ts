import {
  Injectable,
  ApplicationRef,
  EnvironmentInjector,
  createComponent,
  ComponentRef
} from '@angular/core';
import { GlobalLoadingComponent } from '../../shared/components/global-loading/global-loading';


@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingRef: ComponentRef<GlobalLoadingComponent> | null = null;
  private requestCount = 0; // Biến đếm số lượng API đang chạy

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  show() {
    this.requestCount++; // Tăng biến đếm

    // Chỉ tạo DOM khi đây là request đầu tiên (0 -> 1)
    if (this.requestCount === 1 && !this.loadingRef) {
      this.createLoadingComponent();
    }
  }

  hide() {
    if (this.requestCount > 0) {
      this.requestCount--; // Giảm biến đếm
    }

    // Chỉ xóa DOM khi TẤT CẢ request đã xong (về 0)
    if (this.requestCount === 0 && this.loadingRef) {
      this.destroyLoadingComponent();
    }
  }

  // Hàm private: Tạo element và gắn vào body
  private createLoadingComponent() {
    this.loadingRef = createComponent(GlobalLoadingComponent, {
      environmentInjector: this.injector
    });
    this.appRef.attachView(this.loadingRef.hostView);
    const domElem = (this.loadingRef.hostView as any).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);
  }

  // Hàm private: Xóa element khỏi body
  private destroyLoadingComponent() {
    if (this.loadingRef) {
      this.appRef.detachView(this.loadingRef.hostView);
      this.loadingRef.destroy();
      this.loadingRef = null;
    }
  }
}

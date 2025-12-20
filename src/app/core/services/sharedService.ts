// shared.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  // BehaviorSubject giữ giá trị cuối cùng, giúp component mới subscribe vẫn nhận được dữ liệu
  private messageSource = new BehaviorSubject<any>({});
  currentMessage = this.messageSource.asObservable();

  // Hàm thay đổi dữ liệu
  changeMessage(message: any) {
    this.messageSource.next(message);
  }
}

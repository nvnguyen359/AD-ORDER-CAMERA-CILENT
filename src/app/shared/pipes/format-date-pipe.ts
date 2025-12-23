import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatDateVN',
  standalone: true
})
export class FormatDatePipe implements PipeTransform {

 transform(value: string | number | Date | undefined | null): string {
    if (!value) return '';

    // Sử dụng helper formatDate của Angular để xử lý chuẩn xác
    // 'en-US' là locale mặc định, bạn có thể đổi thành 'vi-VN' nếu đã config locale
    try {
      return formatDate(value, 'dd/MM/yyyy HH:mm', 'en-US');
    } catch (error) {
      console.error('Invalid date format:', value);
      return String(value);
    }
  }

}

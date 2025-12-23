import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';

@Pipe({
  name: 'appTimeFormat', // Tên để gọi trong HTML
  standalone: true
})
export class TimeFormatPipe implements PipeTransform {
  /**
   * Chuyển đổi datetime hoặc time string sang định dạng hh:mm AM/PM
   * @param value: Chuỗi thời gian (VD: 2025-12-22T13:30:00)
   */
  transform(value: string | Date | undefined | null): string {
    if (!value) return '';

    try {
      // 'en-US' để đảm bảo hiện AM/PM thay vì SA/CH
      return formatDate(value, 'hh:mm a', 'en-US');
    } catch (error) {
      console.warn('TimeFormatPipe Error:', value);
      return String(value);
    }
  }
}

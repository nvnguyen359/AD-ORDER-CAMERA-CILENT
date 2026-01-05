import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'orderStatus',
  standalone:true
})
export class OrderStatusPipe implements PipeTransform {

 // Map dữ liệu trạng thái
  private statusMap: { [key: string]: string } = {
    'packing': 'Đang đóng gói',
    'packed': 'Đóng gói xong',
    'shipping': 'Đang vận chuyển',
    'closed': 'Hoàn thành',
    'cancelled': 'Đã hủy',
    'pending': 'Chờ xử lý',
    'timeout': 'Hết giờ (Timeout)'
  };

  transform(value: string | undefined | null): string {
    if (!value) return 'Không xác định';

    // Chuyển về chữ thường để so sánh chính xác
    const normalizedValue = value.toLowerCase();

    // Trả về tiếng Việt hoặc giữ nguyên trạng thái gốc nếu không tìm thấy mapping
    return this.statusMap[normalizedValue] || value;
  }
}

import { Component, signal, ViewChild, WritableSignal } from '@angular/core';
import { OrderSearchComponent } from '../../components/order-search.component/order-search.component';
import { OrderListComponent } from '../../components/order-list.component/order-list.component';
import { OrderMobileGridComponent } from '../../components/order-mobile-grid.component/order-mobile-grid.component';
import { Order, OrderGroupViewModel } from '../../core/models/order';
import { OrderVideoAuditComponent } from '../../components/order-video-audit.component/order-video-audit.component';

@Component({
  selector: 'app-history',
  imports: [
    OrderSearchComponent,
    OrderListComponent,
    OrderMobileGridComponent,
    OrderVideoAuditComponent,
  ],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  standalone: true,
})
export class History {
  @ViewChild('orderList') orderListComponent!: OrderListComponent;
  orderLists = signal<Order[]>([]);

  isAuditDialogVisible = false;
  auditConfig: any;
  ngOnInit() {}
  filterChange(event: any) {
    this.orderListComponent.applyExternalFilter(event);
  }

  onOpenAudit(orderData: any) {
    // this.apiService.getAuditLogs(orderData.id).subscribe(response => {
    //    this.isAuditDialogVisible = true;
    //    this.auditConfig = {
    //        data: response.data, // List 14 item như JSON mẫu
    //        id: orderData.specificLogId // (Optional) Nếu muốn play đúng log đó
    //    };
    //});
  }
  eventPlayVideo(event: any=null) {
    if(!Array.isArray(event.data)) return;
    console.log(JSON.stringify(event))
     this.isAuditDialogVisible = true;
     this.auditConfig = event;
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderVideoAuditComponent } from './order-video-audit.component';

describe('OrderVideoAuditComponent', () => {
  let component: OrderVideoAuditComponent;
  let fixture: ComponentFixture<OrderVideoAuditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderVideoAuditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderVideoAuditComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

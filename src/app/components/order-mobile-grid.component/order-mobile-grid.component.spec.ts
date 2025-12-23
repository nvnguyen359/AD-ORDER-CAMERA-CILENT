import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderMobileGridComponent } from './order-mobile-grid.component';

describe('OrderMobileGridComponent', () => {
  let component: OrderMobileGridComponent;
  let fixture: ComponentFixture<OrderMobileGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderMobileGridComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderMobileGridComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CameraWidgetComponent } from './camera-widget.component';

describe('CameraWidgetComponent', () => {
  let component: CameraWidgetComponent;
  let fixture: ComponentFixture<CameraWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CameraWidgetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CameraWidgetComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

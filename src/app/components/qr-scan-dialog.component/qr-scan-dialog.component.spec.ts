import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QrScanDialogComponent } from './qr-scan-dialog.component';

describe('QrScanDialogComponent', () => {
  let component: QrScanDialogComponent;
  let fixture: ComponentFixture<QrScanDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrScanDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QrScanDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

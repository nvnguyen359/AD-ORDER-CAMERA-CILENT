import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAnalysisDialogComponent } from './ai-analysis-dialog.component';

describe('AiAnalysisDialogComponent', () => {
  let component: AiAnalysisDialogComponent;
  let fixture: ComponentFixture<AiAnalysisDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiAnalysisDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiAnalysisDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

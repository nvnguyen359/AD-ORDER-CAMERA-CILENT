import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivityStatsComponent } from './activity-stats.component';

describe('ActivityStatsComponent', () => {
  let component: ActivityStatsComponent;
  let fixture: ComponentFixture<ActivityStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActivityStatsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

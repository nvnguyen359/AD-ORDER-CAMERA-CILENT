import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CamerasComponent } from './cameras.component';

describe('CamerasComponent', () => {
  let component: CamerasComponent;
  let fixture: ComponentFixture<CamerasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CamerasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CamerasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

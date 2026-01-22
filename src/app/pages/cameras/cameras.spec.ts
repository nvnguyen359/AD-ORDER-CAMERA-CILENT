import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cameras } from './cameras';

describe('Cameras', () => {
  let component: Cameras;
  let fixture: ComponentFixture<Cameras>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cameras]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Cameras);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

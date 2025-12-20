import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalLoading } from './global-loading';

describe('GlobalLoading', () => {
  let component: GlobalLoading;
  let fixture: ComponentFixture<GlobalLoading>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalLoading]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalLoading);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

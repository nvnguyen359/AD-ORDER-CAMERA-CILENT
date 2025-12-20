import { TestBed } from '@angular/core/testing';

import { BaseApiServices } from './base-api.services';

describe('BaseApiServices', () => {
  let service: BaseApiServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BaseApiServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

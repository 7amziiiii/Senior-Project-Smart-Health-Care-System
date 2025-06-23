import { TestBed } from '@angular/core/testing';

import { SurgeryDataService } from './surgery-data.service';

describe('SurgeryDataService', () => {
  let service: SurgeryDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SurgeryDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

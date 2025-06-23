import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentsVerificationComponent } from './instruments-verification.component';

describe('InstrumentsVerificationComponent', () => {
  let component: InstrumentsVerificationComponent;
  let fixture: ComponentFixture<InstrumentsVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentsVerificationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentsVerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

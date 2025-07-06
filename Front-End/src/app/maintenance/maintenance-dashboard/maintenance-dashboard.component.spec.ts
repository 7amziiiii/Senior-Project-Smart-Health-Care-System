import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaintenanceDashboardComponent } from './maintenance-dashboard.component';

describe('MaintenanceDashboardComponent', () => {
  let component: MaintenanceDashboardComponent;
  let fixture: ComponentFixture<MaintenanceDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaintenanceDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaintenanceDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { Component } from '@angular/core';
import { DashboardComponent } from '../../components/dashboard.component/dashboard.component';
import { SystemMonitorComponent } from '../../components/system-monitor.component/system-monitor.component';

@Component({
  selector: 'app-dashboard',
  imports: [DashboardComponent,SystemMonitorComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {

}

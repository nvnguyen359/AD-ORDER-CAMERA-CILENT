import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BlockUIModule } from 'primeng/blockui';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api'; // Chỉ import Type, không provide ở đây

import { menuItems } from './Menu';
import { LoadingService } from './core/services/loading.service';
import { AuthService } from './core/services/auth.service';
import { OrderSearchComponent } from './components/order-search.component/order-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterModule,
    CommonModule,
    BadgeModule,
    AvatarModule,
    InputTextModule,
    DrawerModule,
    ButtonModule,
    ProgressSpinnerModule,
    BlockUIModule,
    ToastModule 
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  protected readonly title = signal('AD-ORDER-CAMERA-CILENT');
  visible = false;
  menuItems!: any[];
  protected loadingService = inject(LoadingService);

  // AuthService và Router check
  constructor(
    private router: Router,
    private authService: AuthService,
    private messageService: MessageService // Nó sẽ tự lấy từ Root (AppConfig)
  ) {
    // Logic check auth nên để trong Guard (CanActivate) sẽ tốt hơn constructor
     console.log(authService.isAuthenticated())
    if(!authService.isAuthenticated()){


      // router.navigate(['/monitor'])
    }
  }

  ngOnInit() {
    this.menuItems = menuItems;
  }
}

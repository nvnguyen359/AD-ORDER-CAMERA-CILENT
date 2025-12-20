import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { AuthComponent } from '../../components/auth-component/auth-component';
@Component({
  selector: 'app-auth-page',
  imports: [ButtonModule, CheckboxModule, AuthComponent],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
  standalone: true,
})
export class AuthPage {}

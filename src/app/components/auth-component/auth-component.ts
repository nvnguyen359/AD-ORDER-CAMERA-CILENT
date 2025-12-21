import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SharedService } from '../../core/services/sharedService';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-auth-component',
  imports: [ButtonModule,CheckboxModule,PasswordModule,InputTextModule,CommonModule,ReactiveFormsModule],
  templateUrl: './auth-component.html',
  styleUrl: './auth-component.scss',
  standalone:true,
})
export class AuthComponent implements OnInit{
  form!: FormGroup;
  isLoginMode = true;
password: any;
confirmPassword: any;
  constructor(
    private router: Router,
    private authService: AuthService,
    private fb: FormBuilder,
    private shareService: SharedService
  ) {
   this.form = this.fb.group({
  username: ['', Validators.required],
  password: ['', [Validators.required, Validators.minLength(6)]],
  confirmPassword: [''],
  full_name: [''],
  terms: [] // Thêm dòng này nếu muốn bắt buộc tích
});
  }
  ngOnInit(): void {
    this.shareService.currentMessage.subscribe((data: any) => {
      if (data && data.isShow) {
      }
    });
  }

  // Hàm chuyển đổi chế độ
  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    // Reset form nhẹ nhàng khi chuyển
    this.form.setValue({ password: '' });
    this.form.setValue({ confirmPassword: '' });
    // this.form.reset();
  }

  // Hàm xử lý chung khi bấm nút
  onSubmit() {
    if (this.isLoginMode) {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private handleLogin() {
    try {
      this.authService.loginForm(this.form?.value).subscribe((data: any) => {
        if (data.access_token !='') {
          this.shareService.changeMessage({ isShow: false });
          this.router.navigate(['/monitor']);
        }
      });
    } catch {}
  }

  private handleRegister() {
    const values = this.form?.value;
    this.authService.registerForm(values).subscribe((data) => {
      if (data.code == 200) {
        this.router.navigate(['/']);
        this.shareService.changeMessage({ isShow: true });
      }
    });

    // Giả lập đăng ký thành công -> Tự động chuyển về Login hoặc vào luôn

    this.toggleMode(); // Chuyển về form login
  }
}

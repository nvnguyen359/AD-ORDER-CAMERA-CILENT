import { Component, OnInit, inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

// --- PrimeNG Imports ---
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

// --- Services ---
import { AuthService } from '../../core/services/auth.service';
import { SharedService } from '../../core/services/sharedService'; // Giả sử service này quản lý Header/Sidebar

@Component({
  selector: 'app-auth-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    PasswordModule,
    InputTextModule
  ],
  templateUrl: './auth-component.html',
  styleUrl: './auth-component.scss',
})
export class AuthComponent implements OnInit {
  form!: FormGroup;
  isLoginMode = true;
  isLoading = false; // [MỚI] Biến để hiện loading spinner trên nút

  // Inject services (Phong cách mới hoặc Constructor đều được)
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private shareService = inject(SharedService);
  private messageService = inject(MessageService); // Để hiện toast nếu cần thiết tại đây

  constructor() {
    this.initForm();
  }

  ngOnInit(): void {
    // Ẩn Header/Sidebar khi ở trang Login (nếu SharedService quản lý việc này)
    this.shareService.changeMessage({ isShow: false });
  }

  // Khởi tạo Form
  private initForm() {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''], // Chỉ validate khi ở mode Register
      full_name: [''],      // Chỉ dùng khi Register
      terms: [false]
    });
  }

  // Hàm chuyển đổi chế độ Login <-> Register
  toggleMode() {
    this.isLoginMode = !this.isLoginMode;

    // Reset form để xóa dữ liệu cũ
    this.form.reset();

    // Set lại giá trị mặc định cho checkbox (nếu cần)
    this.form.patchValue({ terms: false });
  }

  // Hàm xử lý chung khi bấm nút Submit
  onSubmit() {
    if (this.form.invalid) {
      // Mark all as touched để hiện lỗi đỏ (nếu template có hiển thị lỗi)
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true; // Bật loading

    if (this.isLoginMode) {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  // --- XỬ LÝ ĐĂNG NHẬP ---
  private handleLogin() {
    this.authService.loginForm(this.form.value).subscribe({
      next: (res) => {
        // [LOGIC QUAN TRỌNG] Kiểm tra Redirect URL
        // 1. Nếu người dùng bị đá từ trang /orders về login -> Login xong quay lại /orders
        // 2. Nếu login bình thường -> Vào /monitor
        const returnUrl = this.authService.redirectUrl || '/';

        // Reset biến redirectUrl
        this.authService.redirectUrl = null;

        // Bật lại Header/Sidebar
        this.shareService.changeMessage({ isShow: true });

        // Điều hướng
        this.router.navigateByUrl(returnUrl);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        // AuthService đã hiện Toast lỗi rồi, nên ở đây chỉ cần tắt loading
      }
    });
  }

  // --- XỬ LÝ ĐĂNG KÝ ---
  private handleRegister() {
    const values = this.form.value;

    // Validate khớp mật khẩu thủ công (hoặc dùng Validator custom)
    if (values.password !== values.confirmPassword) {
      this.messageService.add({severity: 'error', summary: 'Lỗi', detail: 'Mật khẩu xác nhận không khớp'});
      this.isLoading = false;
      return;
    }

    this.authService.registerForm(values).subscribe({
      next: (res) => {
        // Đăng ký thành công
        this.isLoading = false;

        // Chuyển về form Login để người dùng đăng nhập
        this.toggleMode();

        // Hoặc có thể tự động login luôn tùy logic dự án
      },
      error: (err) => {
        this.isLoading = false;
      }
    });
  }
}

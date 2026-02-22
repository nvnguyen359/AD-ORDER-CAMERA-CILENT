import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { jwtDecode } from 'jwt-decode';

// --- PrimeNG Modules ---
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { FloatLabelModule } from 'primeng/floatlabel';

import { UserService, User, UserCreate } from '../../core/services/user.service';
import { environment } from '../../environments/environment';
import { UserUpdate } from '../../core/models/user.models';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule,
    SelectModule, TagModule, ToastModule, ConfirmDialogModule,
    IconFieldModule, InputIconModule, TooltipModule, FloatLabelModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './users-page.html',
  styleUrls: ['./users-page.scss']
})
export class UsersPageComponent implements OnInit {
  private userService = inject(UserService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // --- Quyền hạn (RBAC) ---
  isAdmin = signal<boolean>(false);

  // --- Signals quản lý State ---
  users = signal<User[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(false);

  // Trạng thái Dialog
  userDialog = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  // Chế độ Edit
  isEditMode = signal<boolean>(false);
  editingUserId = signal<number | null>(null);

  userForm!: FormGroup;
  searchKeyword = signal<string>('');
  selectedFilterRole = signal<string | null>(null);

  roleOptions = [
    { label: 'Admin (Quản trị)', value: 'admin' },
    { label: 'Supervisor (Quản lý)', value: 'supervisor' },
    { label: 'Operator (Nhân viên)', value: 'operator' }
  ];

  filterRoleOptions = [{ label: 'Tất cả chức vụ', value: null }, ...this.roleOptions];

  ngOnInit() {
    this.checkAccess(); // Kiểm tra quyền trước
    this.initForm();
  }

  // Lấy role từ JWT Token (Hoặc có thể dùng AuthService)
  checkAccess() {
    const token = localStorage.getItem(environment.ACCESS_TOKEN_KEY);
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // Giả sử payload token có chứa role, hoặc bạn tự gán mặc định Admin nếu sub = admin
        const role = decoded.role || (decoded.sub === 'admin' ? 'admin' : 'operator');

        if (role === 'operator') {
          this.messageService.add({ severity: 'error', summary: 'Từ chối truy cập', detail: 'Nhân viên không có quyền vào trang này' });
          this.router.navigate(['/']); // Đá về trang chủ
          return;
        }

        this.isAdmin.set(role === 'admin'); // Chỉ admin mới có quyền sửa/xóa/mở khóa

      } catch (e) { }
    }
  }

  initForm() {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: [''], // Không bắt buộc khi Edit
      full_name: [''],
      role: ['operator', Validators.required]
    });
  }

  loadUsers(event?: TableLazyLoadEvent) {
    this.loading.set(true);
    const skip = event?.first || 0;
    const limit = event?.rows || 10;
    this.userService.getUsers({ skip, limit, search: this.searchKeyword() || undefined, role: this.selectedFilterRole() || undefined }).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.totalRecords.set(res.data.length >= limit ? skip + limit + 1 : skip + res.data.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() { this.loadUsers(); }

  // --- Mở form TẠO MỚI ---
  openNew() {
    this.isEditMode.set(false);
    this.editingUserId.set(null);
    this.userForm.reset({ role: 'operator' });
    this.userForm.get('username')?.enable(); // Cho phép nhập username
    this.userDialog.set(true);
  }

  // --- Mở form SỬA ---
  openEdit(user: User) {
    this.isEditMode.set(true);
    this.editingUserId.set(user.id);
    this.userForm.patchValue({
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      password: '' // Xóa trống mật khẩu, nhập vào mới đổi
    });
    this.userForm.get('username')?.disable(); // Không cho sửa tên đăng nhập
    this.userDialog.set(true);
  }

  hideDialog() { this.userDialog.set(false); }

  saveUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const formValues = this.userForm.getRawValue(); // Lấy cả giá trị bị disable

    // Xử lý bắt buộc Password khi TẠO MỚI
    if (!this.isEditMode() && (!formValues.password || formValues.password.length < 6)) {
      this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Vui lòng nhập mật khẩu (ít nhất 6 ký tự)' });
      return;
    }

    this.isSaving.set(true);

    if (this.isEditMode()) {
      // API UPDATE
      const updateData: UserUpdate = { full_name: formValues.full_name, role: formValues.role };
      if (formValues.password) updateData.password = formValues.password; // Chỉ gửi pass nếu có nhập

      this.userService.updateUser(this.editingUserId()!, updateData).subscribe({
        next: () => this.handleSuccess('Cập nhật thông tin thành công'),
        error: () => this.handleError('Cập nhật thất bại')
      });
    } else {
      // API CREATE
      this.userService.createUser(formValues as UserCreate).subscribe({
        next: () => this.handleSuccess('Đã tạo tài khoản mới'),
        error: (err) => this.handleError(err.error?.detail === "Username already registered" ? 'Tên đăng nhập đã tồn tại!' : 'Có lỗi khi tạo')
      });
    }
  }

  private handleSuccess(msg: string) {
    this.messageService.add({ severity: 'success', summary: 'Thành công', detail: msg });
    this.isSaving.set(false);
    this.hideDialog();
    this.loadUsers();
  }

  private handleError(msg: string) {
    this.messageService.add({ severity: 'error', summary: 'Thất bại', detail: msg });
    this.isSaving.set(false);
  }

  toggleStatus(user: User) {
    if (!this.isAdmin()) return; // Bảo mật double-check

    const isCurrentlyActive = user.is_active === 1;
    const actionText = isCurrentlyActive ? 'Khóa' : 'Mở khóa';

    this.confirmationService.confirm({
      message: `Bạn có chắc chắn muốn <b>${actionText}</b> tài khoản <b>${user.username}</b> không?`,
      header: 'Xác nhận trạng thái',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: isCurrentlyActive ? 'p-button-danger' : 'p-button-success',
      accept: () => {
        const request = isCurrentlyActive ? this.userService.deactivateUser(user.id) : this.userService.activateUser(user.id);
        request.subscribe({
          next: () => { this.messageService.add({ severity: 'success', summary: 'Thành công', detail: `Đã ${actionText}` }); this.loadUsers(); },
          error: () => this.messageService.add({ severity: 'error', summary: 'Lỗi', detail: 'Thao tác thất bại' })
        });
      }
    });
  }

  getSeverity(role: string) {
    switch (role) { case 'admin': return 'danger'; case 'supervisor': return 'warn'; default: return 'info'; }
  }

  getRoleLabel(role: string) {
    return this.roleOptions.find(r => r.value === role)?.label || role;
  }
}

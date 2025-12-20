import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// --- PRIME NG v21 MODULES ---
import { SelectModule } from 'primeng/select'; // ✅ THAY CHO DropdownModule
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
// ... các module khác (Card, Table, v.v...)

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    SelectModule, // ✅ Import SelectModule
    ButtonModule,
    TagModule,
    AvatarModule,
    SkeletonModule,
    TooltipModule,
    InputTextModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    SelectModule, // ✅ Export để các module con (Monitor, Camera) sử dụng
    ButtonModule,
    TagModule,
    AvatarModule,
    SkeletonModule,
    TooltipModule,
    InputTextModule,
    ReactiveFormsModule
  ]
})
export class SharedModule { }

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: block; }`],
  template: `
    <div class="space-y-2.5 py-1">
      <div class="flex items-center justify-between px-1">
        <label class="block text-xs font-black uppercase text-slate-400 tracking-widest">{{ label() }}</label>
        <ng-content select="[labelAction]"></ng-content>
      </div>
      <div class="relative group">
        <ng-content></ng-content>
      </div>
      @if (error()) {
        <p class="text-[10px] font-bold text-rose-500 px-1 animate-in slide-in-from-top-1">{{ error() }}</p>
      }
    </div>
  `
})
export class FormFieldComponent {
  label = input.required<string>();
  error = input<string | null>(null);
}

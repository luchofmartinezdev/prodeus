import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: block; }`],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      (click)="clicked.emit($event)"
      [class]="classes()"
      class="w-full h-full flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-95 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      @if (loading()) {
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      } @else {
        <ng-content select="[leftIcon]"></ng-content>
        <span>{{ label() }}</span>
        <ng-content></ng-content>
      }
    </button>
  `
})
export class ButtonComponent {
  label = input<string>('');
  type = input<'button' | 'submit'>('button');
  variant = input<'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'dark'>('primary');
  loading = input(false);
  disabled = input(false);
  size = input<'sm' | 'md' | 'lg'>('md');

  clicked = output<MouseEvent>();

  classes = computed(() => {
    let base = '';

    // Tamaños
    if (this.size() === 'sm') base += ' px-5 py-2.5 text-xs ';
    if (this.size() === 'md') base += ' px-7 py-3.5 text-sm ';
    if (this.size() === 'lg') base += ' px-9 py-4.5 text-lg ';

    // Variantes
    switch (this.variant()) {
      case 'primary': base += ' bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 '; break;
      case 'secondary': base += ' bg-indigo-50 text-indigo-600 hover:bg-indigo-100 '; break;
      case 'danger': base += ' bg-red-50 text-red-600 hover:bg-red-100 '; break;
      case 'ghost': base += ' bg-transparent text-slate-500 hover:bg-slate-50 '; break;
      case 'outline': base += ' bg-transparent border border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600 '; break;
      case 'dark': base += ' bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-200 '; break;
    }

    return base;
  });
}

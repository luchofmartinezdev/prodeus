import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="classes()" class="inline-block px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all">
      <ng-content></ng-content>
    </div>
  `
})
export class BadgeComponent {
  variant = input<'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark'>('primary');

  classes = () => {
    const base = 'border-transparent ';
    switch (this.variant()) {
      case 'primary': return base + 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'success': return base + 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'danger': return base + 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'warning': return base + 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'info': return base + 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'dark': return base + 'bg-slate-900 text-white border-slate-900';
      default: return base + 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  }
}

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: block; height: 100%; }`],
  template: `
    <div class="bg-white rounded-3xl sm:rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all h-full">
      <p class="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{{ label() }}</p>
      <div class="flex items-baseline gap-1">
        <span class="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{{ value() }}</span>
        @if (unit()) {
          <span class="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase">{{ unit() }}</span>
        }
      </div>
      @if (tag()) {
        <p class="mt-2 text-[8px] sm:text-[9px] font-bold uppercase" [class]="tagClass()">{{ tag() }}</p>
      }
    </div>

  `
})
export class StatsCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  unit = input<string>();
  tag = input<string>();
  tagColor = input<'amber' | 'emerald' | 'rose' | 'slate'>('amber');

  tagClass = () => {
    switch (this.tagColor()) {
      case 'amber': return 'text-amber-500';
      case 'emerald': return 'text-emerald-500';
      case 'rose': return 'text-rose-500';
      default: return 'text-slate-400';
    }
  }
}

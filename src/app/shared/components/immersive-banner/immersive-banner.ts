import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-immersive-banner',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: block; }`],
  template: `
    <div class="relative overflow-hidden rounded-[2.5rem] bg-slate-900 px-10 py-12 text-white shadow-2xl">
      <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div class="space-y-3 text-center md:text-left">
          <h2 class="text-4xl font-black tracking-tight lg:text-5xl uppercase italic italic-none leading-tight">
            {{ title() }}
          </h2>
          <p class="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-md">
            {{ subtitle() }}
          </p>
        </div>
        
        <div class="flex items-center gap-6 bg-slate-800/40 p-4 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
          <div class="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl shadow-lg shadow-indigo-900/40">
            {{ icon() }}
          </div>
          <div class="hidden sm:block">
              <p class="text-[9px] font-black uppercase text-indigo-400 tracking-widest leading-none mb-1">{{ accentLabel() }}</p>
              <p class="text-xl font-black text-white italic uppercase tracking-tight">{{ accentValue() }}</p>
          </div>
        </div>
      </div>
      
      <!-- Animaciones y decoraciones de fondo -->
      <div class="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]"></div>
      <div class="absolute -bottom-20 left-1/4 h-60 w-60 rounded-full bg-purple-500/10 blur-[80px]"></div>
      <div class="absolute top-1/2 left-10 h-1 w-20 bg-gradient-to-r from-indigo-500/0 via-indigo-500/30 to-indigo-500/0"></div>
    </div>
  `
})
export class ImmersiveBannerComponent {
  title = input.required<string>();
  subtitle = input.required<string>();
  icon = input<string>('⚽');
  accentLabel = input<string>('Tu Temporada');
  accentValue = input<string>('Mundial 2026');
}

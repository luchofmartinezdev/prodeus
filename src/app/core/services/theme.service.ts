import { Injectable, signal } from '@angular/core';

// Light mode overrides injected as a <style> tag at runtime.
// These unlayered rules beat Tailwind's @layer utilities regardless of build state.
//
// Palette: blue-gray tinted page (#eff2f9) + white cards (#fff) + blue-tinted inputs (#f1f5fb)
// Creates a 3-level depth hierarchy (page → card → input) without relying on flat grays.
const LIGHT_CSS = `
  /* ── Backgrounds ── */
  html:not(.dark) .bg-gray-950 { background-color: #eff2f9 !important; }
  html:not(.dark) .bg-gray-900 {
    background-color: #ffffff !important;
    box-shadow: 0 1px 3px 0 rgba(15,23,42,0.07), 0 1px 2px -1px rgba(15,23,42,0.04) !important;
  }
  html:not(.dark) .bg-gray-800 { background-color: #f1f5fb !important; }
  html:not(.dark) .bg-gray-700 { background-color: #e4e9f4 !important; }
  html:not(.dark) .hover\\:bg-gray-800:hover { background-color: #dfe6f5 !important; }
  html:not(.dark) .hover\\:bg-gray-700:hover { background-color: #dce3f0 !important; }

  /* ── Text ── */
  html:not(.dark) .text-white    { color: #0d1117 !important; }
  html:not(.dark) .text-gray-300 { color: #1e293b !important; }
  html:not(.dark) .text-gray-400 { color: #475569 !important; }
  html:not(.dark) .text-gray-500 { color: #64748b !important; }
  html:not(.dark) .text-gray-600 { color: #94a3b8 !important; }
  html:not(.dark) .text-gray-700 { color: #94a3b8 !important; }
  html:not(.dark) .hover\\:text-white:hover    { color: #0d1117 !important; }
  html:not(.dark) .hover\\:text-gray-300:hover { color: #1e293b !important; }

  /* Los botones sólidos (fondo saturado, no reescrito por este tema) necesitan
     que su texto siga blanco — la regla .text-white de arriba solo aplica a
     texto sobre fondos claros (tarjetas, nav), no sobre estos botones. */
  html:not(.dark) .bg-blue-600.text-white,
  html:not(.dark) .bg-red-600.text-white   { color: #ffffff !important; }

  /* ── Borders ── */
  html:not(.dark) .border-gray-800 { border-color: #dde3f0 !important; }
  html:not(.dark) .border-gray-700 { border-color: #c7d0e8 !important; }
  html:not(.dark) .border-gray-600 { border-color: #9ca3af !important; }
  html:not(.dark) .border-gray-900 { border-color: #c7d0e8 !important; }
  html:not(.dark) .divide-gray-800 > * + * { border-color: #dde3f0 !important; }

  /* ── Blue tints (primary brand) ── */
  html:not(.dark) .bg-blue-950   { background-color: #eff6ff !important; }
  html:not(.dark) .bg-blue-900   { background-color: #dbeafe !important; box-shadow: none !important; }
  html:not(.dark) .text-blue-400 { color: #2563eb !important; }
  html:not(.dark) .text-blue-300 { color: #1d4ed8 !important; }
  html:not(.dark) .border-blue-700 { border-color: #bfdbfe !important; }
  html:not(.dark) .border-blue-800 { border-color: #bfdbfe !important; }
  html:not(.dark) .border-blue-900 { border-color: #bfdbfe !important; }
  html:not(.dark) .bg-blue-950\\/50 { background-color: rgba(239,246,255,0.9) !important; }
  html:not(.dark) .bg-blue-800\\/20 { background-color: rgba(59,130,246,0.08) !important; }

  /* ── Orange tints (secondary accent) ── */
  html:not(.dark) .bg-orange-950  { background-color: #fff7ed !important; }
  html:not(.dark) .bg-orange-900  { background-color: #ffedd5 !important; box-shadow: none !important; }
  html:not(.dark) .text-orange-400 { color: #ea580c !important; }
  html:not(.dark) .border-orange-700 { border-color: #fed7aa !important; }
  html:not(.dark) .border-orange-800 { border-color: #fed7aa !important; }
  html:not(.dark) .border-orange-900 { border-color: #fed7aa !important; }
  html:not(.dark) .bg-orange-800\\/20 { background-color: rgba(234,88,12,0.08) !important; }

  /* ── Red ── */
  html:not(.dark) .bg-red-950     { background-color: #fff1f2 !important; }
  html:not(.dark) .bg-red-900     { background-color: #ffe4e6 !important; box-shadow: none !important; }
  html:not(.dark) .border-red-800 { border-color: #fecdd3 !important; }
  html:not(.dark) .border-red-700 { border-color: #fecdd3 !important; }
  html:not(.dark) .text-red-300   { color: #b91c1c !important; }
  html:not(.dark) .text-red-400   { color: #dc2626 !important; }
  html:not(.dark) .hover\\:text-red-400:hover { color: #dc2626 !important; }
  html:not(.dark) .bg-red-950\\/50 { background-color: rgba(255,241,242,0.9) !important; }
  html:not(.dark) .hover\\:bg-red-950\\/40:hover { background-color: rgba(255,228,230,0.6) !important; }

  /* ── Green ── */
  html:not(.dark) .bg-green-900    { background-color: #f0fdf4 !important; box-shadow: none !important; }
  html:not(.dark) .bg-green-950    { background-color: #f0fdf4 !important; }
  html:not(.dark) .text-green-300  { color: #15803d !important; }
  html:not(.dark) .border-green-700 { border-color: #bbf7d0 !important; }
  html:not(.dark) .border-green-800 { border-color: #bbf7d0 !important; }
  html:not(.dark) .hover\\:bg-green-800:hover { background-color: #dcfce7 !important; }

  /* ── Yellow / Amber ── */
  html:not(.dark) .bg-yellow-900    { background-color: #fefce8 !important; box-shadow: none !important; }
  html:not(.dark) .bg-yellow-950    { background-color: #fefce8 !important; }
  html:not(.dark) .text-yellow-300  { color: #a16207 !important; }
  html:not(.dark) .text-yellow-400  { color: #ca8a04 !important; }
  html:not(.dark) .border-yellow-700 { border-color: #fef08a !important; }
  html:not(.dark) .border-yellow-800 { border-color: #fef08a !important; }
  html:not(.dark) .border-yellow-900 { border-color: #fef08a !important; }
  html:not(.dark) .text-amber-600   { color: #92400e !important; }

  /* ── Indigo ── */
  html:not(.dark) .bg-indigo-950    { background-color: #eef2ff !important; }
  html:not(.dark) .border-indigo-800 { border-color: #c7d2fe !important; }
  html:not(.dark) .text-indigo-400  { color: #4f46e5 !important; }

  /* ── Blue active state in nav ── */
  html:not(.dark) .bg-blue-600    { background-color: #2563eb !important; box-shadow: none !important; }
  html:not(.dark) .hover\\:bg-blue-500:hover { background-color: #1d4ed8 !important; }

  /* ── Blue 900/40 (semi-transparent highlight) ── */
  html:not(.dark) .bg-blue-900\\/40 { background-color: rgba(59,130,246,0.10) !important; }

  /* ── Gray 800/60 (semi-transparent cards) ── */
  html:not(.dark) .bg-gray-800\\/60 { background-color: rgba(241,245,251,0.92) !important; }

  /* ── Inputs ── */
  html:not(.dark) input,
  html:not(.dark) select,
  html:not(.dark) textarea {
    color-scheme: light;
    background-color: #f1f5fb;
    color: #0d1117;
  }

  /* ── Placeholder ── */
  html:not(.dark) .placeholder-gray-500::placeholder { color: #94a3b8 !important; }
  html:not(.dark) .placeholder-gray-600::placeholder { color: #94a3b8 !important; }

  /* ── Theme toggle button itself ── */
  html:not(.dark) .p-2.rounded-lg.text-gray-400 { color: #475569 !important; }
`;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal<boolean>(true);

  private styleEl: HTMLStyleElement | null = null;

  constructor() {
    const saved = localStorage.getItem('theme');
    const dark = saved !== 'light';
    this.isDark.set(dark);
    this.apply(dark);
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    this.apply(next);
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);

    if (dark) {
      this.styleEl?.remove();
      this.styleEl = null;
    } else {
      if (!this.styleEl) {
        this.styleEl = document.createElement('style');
        this.styleEl.id = 'prodeus-light-theme';
        this.styleEl.textContent = LIGHT_CSS;
        document.head.appendChild(this.styleEl);
      }
    }
  }
}

import { Injectable, signal } from '@angular/core';

// Light mode overrides injected as a <style> tag at runtime.
// These unlayered rules beat Tailwind's @layer utilities regardless of build state.
const LIGHT_CSS = `
  /* ── Backgrounds ── */
  html:not(.dark) .bg-gray-950  { background-color: #f8fafc !important; }
  html:not(.dark) .bg-gray-900  { background-color: #f1f5f9 !important; }
  html:not(.dark) .bg-gray-800  { background-color: #e2e8f0 !important; }
  html:not(.dark) .bg-gray-700  { background-color: #cbd5e1 !important; }
  html:not(.dark) .hover\\:bg-gray-800:hover { background-color: #e2e8f0 !important; }
  html:not(.dark) .hover\\:bg-gray-700:hover { background-color: #cbd5e1 !important; }

  /* ── Text ── */
  html:not(.dark) .text-white    { color: #0f172a !important; }
  html:not(.dark) .text-gray-300 { color: #334155 !important; }
  html:not(.dark) .text-gray-400 { color: #475569 !important; }
  html:not(.dark) .text-gray-500 { color: #64748b !important; }
  html:not(.dark) .text-gray-600 { color: #94a3b8 !important; }
  html:not(.dark) .text-gray-700 { color: #94a3b8 !important; }
  html:not(.dark) .hover\\:text-white:hover    { color: #0f172a !important; }
  html:not(.dark) .hover\\:text-gray-300:hover { color: #334155 !important; }

  /* ── Borders ── */
  html:not(.dark) .border-gray-800 { border-color: #e2e8f0 !important; }
  html:not(.dark) .border-gray-700 { border-color: #cbd5e1 !important; }
  html:not(.dark) .border-gray-600 { border-color: #cbd5e1 !important; }
  html:not(.dark) .divide-gray-800 > * + * { border-color: #e2e8f0 !important; }

  /* ── Blue tints (primary brand) ── */
  html:not(.dark) .bg-blue-950   { background-color: #eff6ff !important; }
  html:not(.dark) .bg-blue-900   { background-color: #dbeafe !important; }
  html:not(.dark) .text-blue-400 { color: #2563eb !important; }
  html:not(.dark) .text-blue-300 { color: #1d4ed8 !important; }
  html:not(.dark) .border-blue-700 { border-color: #bfdbfe !important; }
  html:not(.dark) .border-blue-800 { border-color: #bfdbfe !important; }

  /* ── Orange tints (secondary accent) ── */
  html:not(.dark) .bg-orange-950  { background-color: #fff7ed !important; }
  html:not(.dark) .bg-orange-900  { background-color: #ffedd5 !important; }
  html:not(.dark) .text-orange-400 { color: #ea580c !important; }
  html:not(.dark) .border-orange-700 { border-color: #fed7aa !important; }
  html:not(.dark) .border-orange-800 { border-color: #fed7aa !important; }

  /* ── Red ── */
  html:not(.dark) .bg-red-950     { background-color: #fff1f2 !important; }
  html:not(.dark) .bg-red-900     { background-color: #ffe4e6 !important; }
  html:not(.dark) .border-red-800 { border-color: #fecdd3 !important; }
  html:not(.dark) .border-red-700 { border-color: #fecdd3 !important; }
  html:not(.dark) .text-red-300   { color: #b91c1c !important; }
  html:not(.dark) .text-red-400   { color: #dc2626 !important; }
  html:not(.dark) .hover\\:text-red-400:hover { color: #dc2626 !important; }

  /* ── Green ── */
  html:not(.dark) .bg-green-900    { background-color: #f0fdf4 !important; }
  html:not(.dark) .text-green-300  { color: #15803d !important; }
  html:not(.dark) .border-green-800 { border-color: #bbf7d0 !important; }

  /* ── Yellow / Amber ── */
  html:not(.dark) .bg-yellow-900    { background-color: #fefce8 !important; }
  html:not(.dark) .text-yellow-300  { color: #a16207 !important; }
  html:not(.dark) .text-yellow-400  { color: #ca8a04 !important; }
  html:not(.dark) .border-yellow-900 { border-color: #fef08a !important; }
  html:not(.dark) .text-amber-600   { color: #92400e !important; }

  /* ── Blue active state in nav ── */
  html:not(.dark) .bg-blue-600    { background-color: #2563eb !important; }
  html:not(.dark) .hover\\:bg-blue-500:hover { background-color: #1d4ed8 !important; }

  /* ── Blue 900/40 (semi-transparent highlight) ── */
  html:not(.dark) .bg-blue-900\\/40 { background-color: rgba(59,130,246,0.12) !important; }

  /* ── Gray 800/60 (semi-transparent cards) ── */
  html:not(.dark) .bg-gray-800\\/60 { background-color: rgba(226,232,240,0.8) !important; }

  /* ── Inputs ── */
  html:not(.dark) input,
  html:not(.dark) select,
  html:not(.dark) textarea {
    color-scheme: light;
    background-color: #f1f5f9;
    color: #0f172a;
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

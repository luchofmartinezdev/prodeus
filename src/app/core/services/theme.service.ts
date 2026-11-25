import { Injectable, signal } from '@angular/core';

// El tema vive en la clase `dark` de <html>. Los colores de cada tema son
// variables CSS definidas en src/styles.input.css, así que acá solo se
// alterna la clase y se recuerda la elección.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal<boolean>(true);

  constructor() {
    const dark = localStorage.getItem('theme') !== 'light';
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
  }
}

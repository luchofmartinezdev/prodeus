import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { supabase } from '../../../data/supabase.client';

@Component({
  selector: 'app-callback',
  template: `
    <div class="min-h-screen bg-gray-950 flex items-center justify-center">
      <div class="text-center">
        <svg
          class="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p class="text-gray-400 text-sm">Iniciando sesión...</p>
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // Supabase procesa el hash/code de la URL automáticamente via onAuthStateChange.
    // Solo necesitamos esperar a que la sesión esté lista y redirigir.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      this.router.navigate(['/app']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }
}

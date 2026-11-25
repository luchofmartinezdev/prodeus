import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map } from 'rxjs';
import { AuthStore } from '../../../state/auth.store';

@Component({
  selector: 'app-callback',
  template: `
    <div class="min-h-screen bg-gray-950 flex items-center justify-center">
      <div class="text-center">
        <svg
          class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4"
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
        <p class="text-gray-400 text-sm">Iniciando sesión…</p>
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly isAuthenticated$ = toObservable(this.authStore.isAuthenticated);

  async ngOnInit(): Promise<void> {
    await this.waitForAuthentication();

    if (this.authStore.isAuthenticated()) {
      this.router.navigate([this.authStore.isSuperadmin() ? '/admin' : '/home']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  private waitForAuthentication(): Promise<void> {
    if (this.authStore.isAuthenticated()) return Promise.resolve();

    return Promise.race([
      firstValueFrom(
        this.isAuthenticated$.pipe(
          filter(Boolean),
          map(() => undefined as void),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
  }
}

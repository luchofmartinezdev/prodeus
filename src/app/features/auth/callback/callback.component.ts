import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../state/auth.store';
import { AuthRepository } from '../../../data/repositories/auth.repository';

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
  private readonly authStore = inject(AuthStore);
  private readonly authRepo = inject(AuthRepository);

  async ngOnInit(): Promise<void> {
    // Wait for the AuthStore to finish processing the session.
    // onAuthStateChange in the store handles the SIGNED_IN event and loads the profile,
    // so we poll until isLoading settles and user is resolved.
    await this.waitForSession();

    if (this.authStore.isAuthenticated()) {
      this.router.navigate([this.authStore.isSuperadmin() ? '/admin' : '/app']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  private waitForSession(): Promise<void> {
    return new Promise((resolve) => {
      // Fallback timeout so we never hang indefinitely.
      const timeout = setTimeout(resolve, 5000);

      const { data } = this.authRepo.onAuthStateChange(async (_event, session) => {
        // Only proceed when we have an actual authenticated session.
        // session can be null on the initial state-change emission — ignoring that
        // is critical to avoid resolving before SIGNED_IN fires.
        if (session?.user) {
          clearTimeout(timeout);
          data.subscription.unsubscribe();
          // The store's own onAuthStateChange handler calls getProfile() async.
          // Poll until isAuthenticated() is true rather than using a fixed delay,
          // so we don't navigate before the store has finished updating.
          await this.untilStoreAuthenticated();
          resolve();
        }
      });
    });
  }

  private untilStoreAuthenticated(): Promise<void> {
    if (this.authStore.isAuthenticated()) return Promise.resolve();
    return new Promise((resolve) => {
      const giveUp = setTimeout(resolve, 3000);
      const poll = setInterval(() => {
        if (this.authStore.isAuthenticated()) {
          clearTimeout(giveUp);
          clearInterval(poll);
          resolve();
        }
      }, 30);
    });
  }
}

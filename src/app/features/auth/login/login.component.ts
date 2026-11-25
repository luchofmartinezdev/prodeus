import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoogleOneTapService } from '../../../core/services/google-one-tap.service';
import { AuthStore } from '../../../state/auth.store';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly oneTap = inject(GoogleOneTapService);

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        this.router.navigate([this.authStore.isSuperadmin() ? '/admin' : '/home']);
      }
    });

    // APP_INITIALIZER ya restauró la sesión: solo se ofrece si no hay usuario
    if (!this.authStore.isAuthenticated()) {
      void this.oneTap.show((idToken) => void this.authStore.signInWithGoogleIdToken(idToken));
    }
    inject(DestroyRef).onDestroy(() => this.oneTap.cancel());
  }

  async onGoogleLogin(): Promise<void> {
    this.oneTap.cancel();
    await this.authStore.signInWithGoogle();
  }
}

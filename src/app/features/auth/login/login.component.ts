import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        this.router.navigate([this.authStore.isSuperadmin() ? '/admin' : '/home']);
      }
    });
  }

  async onGoogleLogin(): Promise<void> {
    await this.authStore.signInWithGoogle();
  }
}

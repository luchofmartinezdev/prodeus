import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { AuthStore } from '../../../state/auth.store';

type AuthTab = 'login' | 'register' | 'magic-link';

@Component({
  selector: 'app-login',
  imports: [FormsModule, ThemeToggleComponent, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  // ─── UI State ───────────────────────────────────────────────
  readonly activeTab = signal<AuthTab>('login');
  readonly showPassword = signal(false);
  readonly magicLinkSent = signal(false);
  readonly confirmationPending = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});

  // ─── Form values ────────────────────────────────────────────
  email = '';
  password = '';
  username = '';
  magicEmail = '';

  constructor() {
    // Redirigir si ya está autenticado
    effect(() => {
      if (!this.authStore.isLoading() && this.authStore.isAuthenticated()) {
        this.router.navigate([this.authStore.isSuperadmin() ? '/admin' : '/app']);
      }
    });
  }

  // ─── Handlers ───────────────────────────────────────────────

  setTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.authStore.clearError();
    this.fieldErrors.set({});
    this.magicLinkSent.set(false);
    this.confirmationPending.set(false);
  }

  async onLoginSubmit(): Promise<void> {
    this.fieldErrors.set({});
    const errors: Record<string, string> = {};

    if (!this.email) errors['email'] = 'El email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) errors['email'] = 'Email inválido';
    if (!this.password) errors['password'] = 'La contraseña es requerida';
    else if (this.password.length < 6) errors['password'] = 'Mínimo 6 caracteres';

    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      return;
    }

    await this.authStore.signInWithEmail({ email: this.email, password: this.password });
  }

  async onRegisterSubmit(): Promise<void> {
    this.fieldErrors.set({});
    const errors: Record<string, string> = {};

    if (!this.email) errors['email'] = 'El email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) errors['email'] = 'Email inválido';
    if (!this.password) errors['password'] = 'La contraseña es requerida';
    else if (this.password.length < 6) errors['password'] = 'Mínimo 6 caracteres';
    if (!this.username) errors['username'] = 'El usuario es requerido';
    else if (this.username.length < 3) errors['username'] = 'Mínimo 3 caracteres';
    else if (!/^[a-zA-Z0-9_]+$/.test(this.username))
      errors['username'] = 'Solo letras, números y guión bajo';

    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      return;
    }

    const ok = await this.authStore.signUp({
      email: this.email,
      password: this.password,
      username: this.username,
    });

    if (ok && !this.authStore.isAuthenticated()) {
      this.confirmationPending.set(true);
    }
  }

  async onMagicLinkSubmit(): Promise<void> {
    this.fieldErrors.set({});
    if (!this.magicEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.magicEmail)) {
      this.fieldErrors.set({ magicEmail: 'Ingresá un email válido' });
      return;
    }
    const ok = await this.authStore.signInWithMagicLink(this.magicEmail);
    if (ok) this.magicLinkSent.set(true);
  }

  async onGoogleLogin(): Promise<void> {
    await this.authStore.signInWithGoogle();
  }
}

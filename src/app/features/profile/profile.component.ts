import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  readonly editing = signal(false);
  readonly saving = signal(false);
  usernameValue = '';

  get isGoogleUser(): boolean {
    return this.authStore.user()?.app_metadata?.['provider'] === 'google';
  }

  get email(): string {
    return this.authStore.user()?.email ?? '';
  }

  get joinedDate(): string {
    const date = this.authStore.profile()?.created_at;
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  get roleLabel(): string {
    return this.authStore.isSuperadmin() ? 'Administrador' : 'Usuario';
  }

  get roleClass(): string {
    return this.authStore.isSuperadmin()
      ? 'bg-indigo-900 text-indigo-300'
      : 'bg-gray-800 text-gray-400';
  }

  openEdit(): void {
    this.usernameValue = this.authStore.profile()?.username ?? '';
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async saveEdit(): Promise<void> {
    const trimmed = this.usernameValue.trim();
    if (!trimmed || trimmed.length < 3) {
      this.toast.error('El usuario debe tener al menos 3 caracteres');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      this.toast.error('Solo letras, números y guión bajo');
      return;
    }
    this.saving.set(true);
    const ok = await this.authStore.updateProfile({ username: trimmed });
    this.saving.set(false);
    if (ok) {
      this.toast.success('Perfil actualizado');
      this.editing.set(false);
    } else {
      this.toast.error('Error al actualizar el perfil');
    }
  }
}

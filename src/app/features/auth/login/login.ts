import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  errorMessage = signal('');

  async login() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.login(this.email, this.password);
      // 'navigate' devuelve un booleano indicando si la navegación fue exitosa
      const success = await this.router.navigate(['/dashboard']);
      if (!success) {
        this.loading.set(false);
      }
    } catch (e: any) {
      console.error('Error en Login:', e);
      this.errorMessage.set('Email o contraseña incorrectos');
      this.loading.set(false);
    }


  }
}
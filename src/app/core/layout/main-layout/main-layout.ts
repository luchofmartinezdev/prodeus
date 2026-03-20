import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { AlertModalComponent } from '../alert-modal/alert-modal';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AlertModalComponent],
  templateUrl: './main-layout.html'
})
export class MainLayoutComponent {
  public auth = inject(AuthService);

  logout() {
    this.auth.logout();
  }
}
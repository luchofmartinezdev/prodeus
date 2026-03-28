import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { AuthStore } from '../../state/auth.store';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, ThemeToggleComponent],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      this.router.navigate([this.authStore.isSuperadmin() ? '/admin' : '/app']);
    }
  }
}

import { Component, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { AuthStore } from '../../../state/auth.store';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
  template: `
    <div class="flex h-screen bg-gray-950 overflow-hidden">
      <!-- Sidebar — desktop only -->
      <aside
        class="hidden md:flex w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col"
      >
        <!-- Logo -->
        <div class="px-5 py-5 border-b border-gray-800">
          <span class="text-white font-black text-xl tracking-tight">PRODEUS</span>
          <span class="ml-2 text-xs text-indigo-400 font-semibold uppercase">Admin</span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a
            routerLink="/admin/tournaments"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Torneos
          </a>
          <a
            routerLink="/admin/rules"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Reglas
          </a>
          <a
            routerLink="/admin/stats"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Estadísticas
          </a>
        </nav>

        <!-- Footer: user info + theme + logout -->
        <div class="px-4 py-4 border-t border-gray-800 space-y-2">
          <!-- User info + theme toggle on same row -->
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              {{ authStore.profile()?.username?.charAt(0)?.toUpperCase() ?? 'A' }}
            </div>
            <span class="text-gray-300 text-sm truncate flex-1">{{
              authStore.profile()?.username
            }}</span>
            <app-theme-toggle />
          </div>

          <!-- Sign out -->
          <button
            type="button"
            (click)="authStore.signOut()"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <!-- Overlay — mobile only, visible when sidebar is open -->
      @if (sidebarOpen()) {
        <div
          class="md:hidden fixed inset-0 bg-black/50 z-30"
          (click)="sidebarOpen.set(false)"
        ></div>
      }

      <!-- Sidebar drawer — mobile only -->
      <aside
        class="md:hidden fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40 transition-transform duration-300 ease-in-out"
        [class.translate-x-0]="sidebarOpen()"
        [class.-translate-x-full]="!sidebarOpen()"
      >
        <!-- Logo + close button -->
        <div class="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <span class="text-white font-black text-xl tracking-tight">PRODEUS</span>
            <span class="ml-2 text-xs text-indigo-400 font-semibold uppercase">Admin</span>
          </div>
          <button
            type="button"
            (click)="sidebarOpen.set(false)"
            class="text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a
            routerLink="/admin/tournaments"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Torneos
          </a>
          <a
            routerLink="/admin/rules"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Reglas
          </a>
          <a
            routerLink="/admin/stats"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Estadísticas
          </a>
        </nav>

        <!-- Footer: user info + theme + logout -->
        <div class="px-4 py-4 border-t border-gray-800 space-y-2">
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              {{ authStore.profile()?.username?.charAt(0)?.toUpperCase() ?? 'A' }}
            </div>
            <span class="text-gray-300 text-sm truncate flex-1">{{
              authStore.profile()?.username
            }}</span>
            <app-theme-toggle />
          </div>
          <button
            type="button"
            (click)="authStore.signOut()"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <!-- Bottom nav — mobile only -->
      <nav
        class="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex items-stretch z-50"
      >
        <a
          routerLink="/admin/tournaments"
          routerLinkActive="text-indigo-400"
          [routerLinkActiveOptions]="{ exact: false }"
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-500 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span class="text-xs font-medium">Torneos</span>
        </a>
        <a
          routerLink="/admin/rules"
          routerLinkActive="text-indigo-400"
          [routerLinkActiveOptions]="{ exact: true }"
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-500 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <span class="text-xs font-medium">Reglas</span>
        </a>
        <button
          type="button"
          (click)="sidebarOpen.set(!sidebarOpen())"
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-500 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span class="text-xs font-medium">Menú</span>
        </button>
      </nav>

      <!-- Content -->
      <main class="flex-1 overflow-y-auto pb-16 md:pb-0">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly sidebarOpen = signal(false);
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.sidebarOpen.set(false));
  }
}

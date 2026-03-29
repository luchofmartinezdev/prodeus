import { Component, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { AuthStore } from '../../../state/auth.store';

@Component({
  selector: 'app-user-layout',
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
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a
            routerLink="/app"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Inicio
          </a>
          <a
            routerLink="/app/groups"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Mis grupos
          </a>
        </nav>

        <!-- Footer: user info + theme + logout -->
        <div class="px-4 py-4 border-t border-gray-800 space-y-2">
          <div class="flex items-center gap-2">
            @if (authStore.avatarUrl()) {
              <img
                [src]="authStore.avatarUrl()"
                alt="Avatar"
                class="w-7 h-7 rounded-full object-cover shrink-0"
                referrerpolicy="no-referrer"
              />
            } @else {
              <div
                class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0"
              >
                {{ authStore.displayName()?.charAt(0)?.toUpperCase() ?? 'U' }}
              </div>
            }
            <span class="text-gray-300 text-sm truncate flex-1">{{ authStore.displayName() }}</span>
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

      <!-- Content -->
      <main class="flex-1 overflow-y-auto pb-16 md:pb-0">
        <router-outlet />
      </main>

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
          <span class="text-white font-black text-xl tracking-tight">PRODEUS</span>
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
            routerLink="/app"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Inicio
          </a>
          <a
            routerLink="/app/groups"
            routerLinkActive="bg-indigo-600 text-white"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Mis grupos
          </a>
        </nav>

        <!-- Footer: user info + theme + logout -->
        <div class="px-4 py-4 border-t border-gray-800 space-y-2">
          <div class="flex items-center gap-2">
            @if (authStore.avatarUrl()) {
              <img
                [src]="authStore.avatarUrl()"
                alt="Avatar"
                class="w-7 h-7 rounded-full object-cover shrink-0"
                referrerpolicy="no-referrer"
              />
            } @else {
              <div
                class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0"
              >
                {{ authStore.displayName()?.charAt(0)?.toUpperCase() ?? 'U' }}
              </div>
            }
            <span class="text-gray-300 text-sm truncate flex-1">{{ authStore.displayName() }}</span>
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
          routerLink="/app"
          routerLinkActive="text-indigo-400"
          [routerLinkActiveOptions]="{ exact: true }"
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-500 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span class="text-xs font-medium">Inicio</span>
        </a>
        <a
          routerLink="/app/groups"
          routerLinkActive="text-indigo-400"
          [routerLinkActiveOptions]="{ exact: false }"
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-500 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span class="text-xs font-medium">Mis grupos</span>
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
    </div>
  `,
})
export class UserLayoutComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly sidebarOpen = signal(false);
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.sidebarOpen.set(false));
  }
}

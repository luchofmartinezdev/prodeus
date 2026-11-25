import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { AuthStore } from '../../../state/auth.store';

interface NavItem {
  link: string;
  label: string;
  exact: boolean;
  /** Path de un ícono outline de 24x24 */
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    link: '/home',
    label: 'Inicio',
    exact: true,
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    link: '/home/groups',
    label: 'Mis grupos',
    exact: false,
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    link: '/home/rules',
    label: 'Reglas',
    exact: false,
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    link: '/home/profile',
    label: 'Mi perfil',
    exact: false,
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

const LOGOUT_ICON =
  'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1';

@Component({
  selector: 'app-user-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    ConfirmModalComponent,
  ],
  template: `
    <!-- Contenido de la barra lateral: se reutiliza en escritorio y en el cajón móvil -->
    <ng-template #sidebarBody>
      <nav class="flex-1 px-3 py-4 space-y-1" aria-label="Principal">
        @for (item of navItems; track item.link) {
          <a
            [routerLink]="item.link"
            routerLinkActive="bg-blue-600 text-white"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg
              class="w-[18px] h-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
            </svg>
            {{ item.label }}
          </a>
        }
      </nav>

      <div class="px-4 py-4 border-t border-gray-800 space-y-2">
        <div class="flex items-center gap-2.5">
          @if (authStore.avatarUrl()) {
            <img
              [src]="authStore.avatarUrl()"
              alt=""
              class="w-8 h-8 rounded-full object-cover shrink-0"
              referrerpolicy="no-referrer"
            />
          } @else {
            <div
              class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              {{ authStore.displayName()?.charAt(0)?.toUpperCase() ?? 'U' }}
            </div>
          }
          <span class="text-gray-200 text-sm font-medium truncate flex-1">{{
            authStore.displayName()
          }}</span>
          <app-theme-toggle />
        </div>
        <button
          type="button"
          (click)="showSignOutModal.set(true)"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <svg
            class="w-[18px] h-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="logoutIcon" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </ng-template>

    <div class="flex h-screen bg-gray-950 overflow-hidden">
      <!-- Barra lateral: escritorio -->
      <aside
        class="hidden md:flex w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col"
      >
        <a routerLink="/home" class="px-5 h-16 flex items-center gap-2.5 border-b border-gray-800">
          <img src="assets/images/prodeus.png" alt="" class="w-8 h-8 object-contain" />
          <span class="t-display text-2xl text-white">Prodeus</span>
        </a>
        <ng-container [ngTemplateOutlet]="sidebarBody" />
      </aside>

      <!-- Contenido -->
      <main class="flex-1 overflow-y-auto pb-20 md:pb-0">
        <router-outlet />
      </main>

      @if (sidebarOpen()) {
        <div
          class="md:hidden fixed inset-0 bg-black/60 z-[60]"
          (click)="sidebarOpen.set(false)"
          aria-hidden="true"
        ></div>
      }

      <!-- Cajón: móvil -->
      <aside
        class="md:hidden fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-[70] transition-transform duration-300 ease-in-out"
        [class.translate-x-0]="sidebarOpen()"
        [class.-translate-x-full]="!sidebarOpen()"
      >
        <div class="px-5 h-16 border-b border-gray-800 flex items-center justify-between">
          <span class="t-display text-2xl text-white">Prodeus</span>
          <button
            type="button"
            (click)="sidebarOpen.set(false)"
            aria-label="Cerrar menú"
            class="text-gray-300 hover:text-white transition-colors p-1"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ng-container [ngTemplateOutlet]="sidebarBody" />
      </aside>

      @if (showSignOutModal()) {
        <app-confirm-modal
          title="Cerrar sesión"
          message="¿Estás seguro que querés cerrar la sesión?"
          confirmLabel="Cerrar sesión"
          (confirmed)="authStore.signOut()"
          (cancelled)="showSignOutModal.set(false)"
        />
      }

      <!-- Navegación inferior: móvil -->
      <nav
        class="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex items-stretch z-50"
        aria-label="Acceso rápido"
      >
        @for (item of navItems.slice(0, 2); track item.link) {
          <a
            [routerLink]="item.link"
            routerLinkActive="!text-orange-400"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
            </svg>
            <span class="text-[11px] font-semibold">{{ item.label }}</span>
          </a>
        }
        <button
          type="button"
          (click)="sidebarOpen.set(!sidebarOpen())"
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-gray-400 hover:text-white transition-colors"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span class="text-[11px] font-semibold">Menú</span>
        </button>
      </nav>
    </div>
  `,
})
export class UserLayoutComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly sidebarOpen = signal(false);
  protected readonly showSignOutModal = signal(false);
  protected readonly navItems = NAV_ITEMS;
  protected readonly logoutIcon = LOGOUT_ICON;
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sidebarOpen.set(false));
  }
}

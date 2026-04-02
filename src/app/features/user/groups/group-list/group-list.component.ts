import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GroupStore } from '../../../../state/group.store';
import { AuthStore } from '../../../../state/auth.store';

@Component({
  selector: 'app-group-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './group-list.component.html',
})
export class GroupListComponent {
  protected readonly store = inject(GroupStore);
  private readonly authStore = inject(AuthStore);

  readonly showJoinForm = signal(false);
  joinCodeValue = '';

  constructor() {
    effect(() => {
      const isAuth = this.authStore.isAuthenticated();
      const isLoadingAuth = this.authStore.isLoading();

      if (!isLoadingAuth && isAuth) {
        // 2. Envolvemos la ejecución en untracked
        untracked(() => {
          this.store.loadMyGroups();
        });
      }
    });
  }

  async onJoin(): Promise<void> {
    if (!this.joinCodeValue.trim()) return;
    const status = await this.store.joinByCode(this.joinCodeValue.trim());
    if (status) {
      this.joinCodeValue = '';
      this.showJoinForm.set(false);
    }
  }

  joinModeLabel(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'Abierto' : 'Cerrado';
  }

  joinModeClass(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300';
  }
}

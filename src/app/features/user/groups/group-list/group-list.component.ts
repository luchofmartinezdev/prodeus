import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GroupStore } from '../../../../state/group.store';
import { AuthStore } from '../../../../state/auth.store';

@Component({
  selector: 'app-group-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './group-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupListComponent implements OnInit {
  protected readonly store = inject(GroupStore);
  private readonly authStore = inject(AuthStore);

  readonly showJoinForm = signal(false);
  readonly isLoadingGroups = signal(true);
  joinCodeValue = '';

  ngOnInit(): void {
    this.store.loadMyGroups().finally(() => this.isLoadingGroups.set(false));
  }

  async onJoin(): Promise<void> {
    if (!this.joinCodeValue.trim()) return;
    const status = await this.store.joinByCode(this.joinCodeValue.trim());
    if (status) {
      this.joinCodeValue = '';
      this.showJoinForm.set(false);
    }
  }

  get currentUserId(): string | undefined {
    return this.authStore.user()?.id;
  }

  joinModeLabel(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'Abierto' : 'Cerrado';
  }

  joinModeClass(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300';
  }
}

import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GroupService } from '../../core/services/group.service';
import { PendingInviteService } from '../../core/services/pending-invite.service';
import type { GroupWithTournament } from '../../data/repositories/group.repository';
import { GroupStore } from '../../state/group.store';

type InviteStatus = 'loading' | 'ready' | 'inactive' | 'invalid';

@Component({
  selector: 'app-join-invite',
  imports: [RouterLink],
  templateUrl: './join-invite.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoinInviteComponent implements OnInit {
  /** Código que llega en la URL (/unirse/:code) */
  readonly code = input.required<string>();

  private readonly router = inject(Router);
  private readonly groupService = inject(GroupService);
  private readonly pendingInvite = inject(PendingInviteService);
  private readonly groupStore = inject(GroupStore);

  readonly status = signal<InviteStatus>('loading');
  readonly group = signal<GroupWithTournament | null>(null);
  readonly isJoining = signal(false);

  async ngOnInit(): Promise<void> {
    // La invitación ya llegó a destino
    this.pendingInvite.clear();

    const code = this.pendingInvite.normalize(this.code());
    if (!code) {
      this.status.set('invalid');
      return;
    }

    try {
      const [group] = await Promise.all([
        this.groupService.findByCode(code),
        this.groupStore.loadMyGroups(),
      ]);
      if (this.groupStore.groups().some((g) => g.id === group.id)) {
        await this.openGroup(group.id);
        return;
      }
      this.group.set(group);
      this.status.set(group.tournament?.status === 'active' ? 'ready' : 'inactive');
    } catch {
      this.status.set('invalid');
    }
  }

  async join(): Promise<void> {
    const group = this.group();
    if (!group) return;

    this.isJoining.set(true);
    const joined = await this.groupStore.joinByCode(group.invite_code);
    this.isJoining.set(false);
    // Si falla, el store ya muestra el aviso
    if (joined) await this.openGroup(group.id);
  }

  private async openGroup(id: string): Promise<void> {
    await this.router.navigate(['/home/groups', id], { replaceUrl: true });
  }
}

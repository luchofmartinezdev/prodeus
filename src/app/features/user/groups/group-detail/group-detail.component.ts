import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../state/auth.store';
import { GroupStore } from '../../../../state/group.store';

@Component({
  selector: 'app-group-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './group-detail.component.html',
})
export class GroupDetailComponent implements OnInit {
  @Input() id!: string;

  protected readonly store = inject(GroupStore);
  protected readonly authStore = inject(AuthStore);

  // Inline edit state
  readonly editing = signal(false);
  readonly copied = signal(false);
  editName = '';
  editJoinMode: 'open' | 'closed' = 'open';

  ngOnInit(): void {
    this.store.loadOne(this.id);
    this.store.loadMembers(this.id);
  }

  get isLeader(): boolean {
    return this.store.selected()?.leader_id === this.authStore.user()?.id;
  }

  openEdit(): void {
    const g = this.store.selected();
    if (!g) return;
    this.editName = g.name;
    this.editJoinMode = g.join_mode;
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async saveEdit(): Promise<void> {
    if (!this.editName.trim()) return;
    await this.store.update(this.id, {
      name: this.editName.trim(),
      join_mode: this.editJoinMode,
    });
    this.editing.set(false);
  }

  async copyInviteCode(code: string): Promise<void> {
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async onDelete(): Promise<void> {
    const g = this.store.selected();
    if (!g) return;
    if (!confirm(`¿Eliminar el grupo "${g.name}"? Esta acción no se puede deshacer.`)) return;
    await this.store.remove(this.id);
  }

  joinModeLabel(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'Abierto' : 'Cerrado';
  }

  joinModeClass(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300';
  }

  avatarLetter(username: string): string {
    return username.charAt(0).toUpperCase();
  }
}

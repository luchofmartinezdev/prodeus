import { inject, Injectable } from '@angular/core';
import {
  GroupRepository,
  type GroupDto,
  type GroupWithTournament,
  type MemberWithProfile,
} from '../../data/repositories/group.repository';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly repo = inject(GroupRepository);

  async getMyGroups(userId: string, signal?: AbortSignal): Promise<GroupWithTournament[]> {
    const { data, error } = await this.repo.findByUser(userId, signal);
    // RLS may return an error when the user has no rows yet — treat as empty
    if (error && (!data || (data as unknown[]).length === 0)) return [];
    if (error) throw new Error('No se pudieron cargar tus grupos');
    return (data ?? [])
      .map((d) => (d as unknown as { groups: GroupWithTournament }).groups)
      .filter((g): g is GroupWithTournament => g !== null);
  }

  async getOne(id: string): Promise<GroupWithTournament> {
    const { data, error } = await this.repo.findOne(id);
    if (error) throw new Error('No se pudo cargar el grupo');
    return data as unknown as GroupWithTournament;
  }

  async getMembers(groupId: string): Promise<MemberWithProfile[]> {
    const { data, error } = await this.repo.findMembers(groupId);
    if (error) throw new Error('No se pudieron cargar los miembros');
    return (data ?? []) as unknown as MemberWithProfile[];
  }

  async create(dto: GroupDto, leaderId: string): Promise<GroupWithTournament> {
    // Step 1: insert group, get only the id back
    const { data: created, error } = await this.repo.create(dto, leaderId);
    if (error) {
      if (error.code === '23505') throw new Error('Ya tenés un grupo en este torneo');
      throw new Error('No se pudo crear el grupo');
    }
    // Step 2: add leader as active member (now the group exists)
    await this.repo.addMember(created!.id, leaderId, 'active');
    // Step 3: fetch full group with tournament (leader is now a member, RLS SELECT passes)
    return this.getOne(created!.id);
  }

  async update(
    id: string,
    dto: Partial<Pick<GroupDto, 'name' | 'join_mode'>>,
  ): Promise<GroupWithTournament> {
    const { data, error } = await this.repo.update(id, dto);
    if (error) throw new Error('No se pudo actualizar el grupo');
    return data as unknown as GroupWithTournament;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.repo.remove(id);
    if (error) throw new Error('No se pudo eliminar el grupo');
  }

  async joinByCode(
    code: string,
    userId: string,
  ): Promise<{ group: GroupWithTournament; status: 'pending' | 'active' }> {
    const { data: group, error: findError } = await this.repo.findByInviteCode(code);
    if (findError || !group) throw new Error('Código de invitación inválido');

    const g = group as unknown as GroupWithTournament;
    if (g.tournament?.status !== 'active')
      throw new Error('El torneo de este grupo no está activo');

    const memberStatus = g.join_mode === 'open' ? 'active' : 'pending';
    const { error: joinError } = await this.repo.joinGroup(g.id, userId, memberStatus);
    if (joinError) {
      if (joinError.code === '23505') throw new Error('Ya sos miembro de este grupo');
      throw new Error('No se pudo unir al grupo');
    }

    return { group: g, status: memberStatus };
  }

  async approveMember(memberId: string): Promise<void> {
    const { error } = await this.repo.updateMemberStatus(memberId, 'active');
    if (error) throw new Error('No se pudo aprobar el miembro');
  }

  async rejectMember(memberId: string): Promise<void> {
    const { error } = await this.repo.updateMemberStatus(memberId, 'removed');
    if (error) throw new Error('No se pudo rechazar el miembro');
  }

  async removeMember(memberId: string): Promise<void> {
    const { error } = await this.repo.updateMemberStatus(memberId, 'removed');
    if (error) throw new Error('No se pudo remover el miembro');
  }

  async leave(groupId: string, userId: string): Promise<void> {
    const { error } = await this.repo.leave(groupId, userId);
    if (error) throw new Error('No se pudo salir del grupo');
  }
}

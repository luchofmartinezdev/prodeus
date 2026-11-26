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
    if (error) throw new Error('No se pudieron cargar tus grupos');
    return data ?? [];
  }

  async getPublicGroups(): Promise<GroupWithTournament[]> {
    const { data, error } = await this.repo.findPublicGroups();
    if (error) throw new Error('No se pudieron cargar los grupos públicos');
    return data ?? [];
  }

  async getOne(id: string): Promise<GroupWithTournament> {
    const { data, error } = await this.repo.findOne(id);
    if (error) throw new Error('No se pudo cargar el grupo');
    return data as GroupWithTournament;
  }

  async getMembers(groupId: string): Promise<MemberWithProfile[]> {
    const { data, error } = await this.repo.findMembers(groupId);
    if (error) throw new Error('No se pudieron cargar los miembros');
    return data ?? [];
  }

  async create(dto: GroupDto, leaderId: string): Promise<GroupWithTournament> {
    // El alta del líder como miembro activo la maneja server-side la Cloud
    // Function onGroupCreate — no hace falta un segundo paso acá.
    const { data, error } = await this.repo.create(dto, leaderId);
    if (error) throw new Error('No se pudo crear el grupo');
    return data as GroupWithTournament;
  }

  async update(
    id: string,
    dto: Partial<Pick<GroupDto, 'name' | 'visibility'>>,
  ): Promise<GroupWithTournament> {
    const { data, error } = await this.repo.update(id, dto);
    if (error) throw new Error('No se pudo actualizar el grupo');
    return data as GroupWithTournament;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.repo.remove(id);
    if (error) throw new Error('No se pudo eliminar el grupo');
  }

  /** Busca un grupo por su código, sin unirse. */
  async findByCode(code: string): Promise<GroupWithTournament> {
    const { data: group, error } = await this.repo.findByInviteCode(code);
    if (error || !group) throw new Error('Código de invitación inválido');
    return group;
  }

  /** Unirse por código de invitación (6 caracteres) — grupo público o privado. */
  async joinByCode(code: string, userId: string): Promise<GroupWithTournament> {
    const { data: group, error: findError } = await this.repo.findByInviteCode(code);
    if (findError || !group) throw new Error('Código de invitación inválido');
    return this.joinResolvedGroup(group, userId);
  }

  /** Unirse a un grupo público ya conocido (desde el listado de /home). */
  async joinById(groupId: string, userId: string): Promise<GroupWithTournament> {
    const { data: group, error: findError } = await this.repo.findOne(groupId);
    if (findError || !group) throw new Error('Grupo no encontrado');
    return this.joinResolvedGroup(group, userId);
  }

  private async joinResolvedGroup(
    group: GroupWithTournament,
    userId: string,
  ): Promise<GroupWithTournament> {
    if (group.tournament?.status !== 'active') {
      throw new Error('El torneo de este grupo no está activo');
    }
    const { error: joinError } = await this.repo.joinGroup(group.id, userId);
    if (joinError) throw new Error('No se pudo unir al grupo');
    return group;
  }

  async removeMember(memberId: string, groupId: string): Promise<void> {
    const { error } = await this.repo.updateMemberStatus(groupId, memberId, 'removed');
    if (error) throw new Error('No se pudo remover el miembro');
  }

  async leave(groupId: string, userId: string): Promise<void> {
    const { error } = await this.repo.leave(groupId, userId);
    if (error) throw new Error('No se pudo salir del grupo');
  }
}

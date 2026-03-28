import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GroupService } from './group.service';
import { GroupRepository } from '../../data/repositories/group.repository';
import type { GroupWithTournament } from '../../data/repositories/group.repository';

const mockRepo = {
  findByUser: vi.fn(),
  findOne: vi.fn(),
  findMembers: vi.fn(),
  create: vi.fn(),
  addMember: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findByInviteCode: vi.fn(),
  joinGroup: vi.fn(),
  updateMemberStatus: vi.fn(),
};

const fakeGroup = (overrides: Partial<GroupWithTournament> = {}): GroupWithTournament =>
  ({
    id: 'group-1',
    name: 'Los cracks',
    join_mode: 'open',
    leader_id: 'user-1',
    invite_code: 'ABC12345',
    tournament_id: 'tour-1',
    tournament: { id: 'tour-1', name: 'Liga 2025', status: 'active' },
    created_at: new Date().toISOString(),
    ...overrides,
  }) as unknown as GroupWithTournament;

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        GroupService,
        { provide: GroupRepository, useValue: mockRepo },
      ],
    });
    service = TestBed.inject(GroupService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── getMyGroups ─────────────────────────────────────────────

  it('getMyGroups() returns empty array when RLS error with no data', async () => {
    mockRepo.findByUser.mockResolvedValue({ data: [], error: { message: 'RLS' } });
    const result = await service.getMyGroups('user-1');
    expect(result).toEqual([]);
  });

  it('getMyGroups() returns empty array when data is null and error', async () => {
    mockRepo.findByUser.mockResolvedValue({ data: null, error: { message: 'RLS' } });
    const result = await service.getMyGroups('user-1');
    expect(result).toEqual([]);
  });

  it('getMyGroups() throws when error with non-empty data', async () => {
    mockRepo.findByUser.mockResolvedValue({
      data: [{ groups: fakeGroup() }],
      error: { message: 'real error' },
    });
    await expect(service.getMyGroups('user-1')).rejects.toThrow('No se pudieron cargar tus grupos');
  });

  it('getMyGroups() maps nested groups structure correctly', async () => {
    const group = fakeGroup();
    mockRepo.findByUser.mockResolvedValue({
      data: [{ groups: group }],
      error: null,
    });
    const result = await service.getMyGroups('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('group-1');
  });

  it('getMyGroups() filters out null groups', async () => {
    mockRepo.findByUser.mockResolvedValue({
      data: [{ groups: fakeGroup() }, { groups: null }],
      error: null,
    });
    const result = await service.getMyGroups('user-1');
    expect(result).toHaveLength(1);
  });

  // ─── joinByCode ──────────────────────────────────────────────

  it('joinByCode() throws when invite code is invalid', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    await expect(service.joinByCode('INVALID', 'user-1')).rejects.toThrow(
      'Código de invitación inválido',
    );
  });

  it('joinByCode() throws when tournament is not active', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({
      data: fakeGroup({ tournament: { id: 'tour-1', name: 'Liga', status: 'closed' } }),
      error: null,
    });
    await expect(service.joinByCode('ABC12345', 'user-1')).rejects.toThrow(
      'El torneo de este grupo no está activo',
    );
  });

  it('joinByCode() returns status active for open join_mode', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({
      data: fakeGroup({ join_mode: 'open' }),
      error: null,
    });
    mockRepo.joinGroup.mockResolvedValue({ error: null });
    const result = await service.joinByCode('ABC12345', 'user-2');
    expect(result.status).toBe('active');
  });

  it('joinByCode() returns status pending for closed join_mode', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({
      data: fakeGroup({ join_mode: 'closed' }),
      error: null,
    });
    mockRepo.joinGroup.mockResolvedValue({ error: null });
    const result = await service.joinByCode('ABC12345', 'user-2');
    expect(result.status).toBe('pending');
  });

  it('joinByCode() returns the group', async () => {
    const group = fakeGroup();
    mockRepo.findByInviteCode.mockResolvedValue({ data: group, error: null });
    mockRepo.joinGroup.mockResolvedValue({ error: null });
    const result = await service.joinByCode('ABC12345', 'user-2');
    expect(result.group.id).toBe('group-1');
  });

  it('joinByCode() throws friendly message when already a member (23505)', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({ data: fakeGroup(), error: null });
    mockRepo.joinGroup.mockResolvedValue({ error: { code: '23505' } });
    await expect(service.joinByCode('ABC12345', 'user-1')).rejects.toThrow(
      'Ya sos miembro de este grupo',
    );
  });

  it('joinByCode() throws generic error on other join errors', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({ data: fakeGroup(), error: null });
    mockRepo.joinGroup.mockResolvedValue({ error: { code: '99999', message: 'other' } });
    await expect(service.joinByCode('ABC12345', 'user-2')).rejects.toThrow(
      'No se pudo unir al grupo',
    );
  });

  // ─── create ──────────────────────────────────────────────────

  it('create() throws friendly message on duplicate group (23505)', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { code: '23505' } });
    await expect(
      service.create({ name: 'G', tournament_id: 't', join_mode: 'open' }, 'user-1'),
    ).rejects.toThrow('Ya tenés un grupo en este torneo');
  });

  it('create() calls addMember then getOne steps', async () => {
    const created = { id: 'new-group-id' };
    const fullGroup = fakeGroup({ id: 'new-group-id' });
    mockRepo.create.mockResolvedValue({ data: created, error: null });
    mockRepo.addMember.mockResolvedValue({ error: null });
    mockRepo.findOne.mockResolvedValue({ data: fullGroup, error: null });

    await service.create({ name: 'G', tournament_id: 't', join_mode: 'open' }, 'user-1');

    expect(mockRepo.addMember).toHaveBeenCalledWith('new-group-id', 'user-1', 'active');
    expect(mockRepo.findOne).toHaveBeenCalledWith('new-group-id');
  });

  // ─── approveMember / rejectMember / removeMember ─────────────

  it('approveMember() throws on error', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.approveMember('member-1')).rejects.toThrow(
      'No se pudo aprobar el miembro',
    );
  });

  it('rejectMember() throws on error', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.rejectMember('member-1')).rejects.toThrow(
      'No se pudo rechazar el miembro',
    );
  });

  it('removeMember() throws on error', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.removeMember('member-1')).rejects.toThrow('No se pudo remover el miembro');
  });

  it('approveMember() calls updateMemberStatus with active', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: null });
    await service.approveMember('member-1');
    expect(mockRepo.updateMemberStatus).toHaveBeenCalledWith('member-1', 'active');
  });

  it('rejectMember() calls updateMemberStatus with removed', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: null });
    await service.rejectMember('member-1');
    expect(mockRepo.updateMemberStatus).toHaveBeenCalledWith('member-1', 'removed');
  });
});

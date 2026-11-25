import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GroupService } from './group.service';
import { GroupRepository } from '../../data/repositories/group.repository';
import type { GroupWithTournament } from '../../data/repositories/group.repository';

const mockRepo = {
  findByUser: vi.fn(),
  findOne: vi.fn(),
  findPublicGroups: vi.fn(),
  findMembers: vi.fn(),
  create: vi.fn(),
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
    visibility: 'public',
    leader_id: 'user-1',
    invite_code: 'A3F9K2',
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

  it('getMyGroups() throws on error', async () => {
    mockRepo.findByUser.mockResolvedValue({ data: null, error: { message: 'firestore error' } });
    await expect(service.getMyGroups('user-1')).rejects.toThrow('No se pudieron cargar tus grupos');
  });

  it('getMyGroups() returns the groups from the repository', async () => {
    const group = fakeGroup();
    mockRepo.findByUser.mockResolvedValue({ data: [group], error: null });
    const result = await service.getMyGroups('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('group-1');
  });

  it('getMyGroups() returns empty array when data is null', async () => {
    mockRepo.findByUser.mockResolvedValue({ data: null, error: null });
    const result = await service.getMyGroups('user-1');
    expect(result).toEqual([]);
  });

  // ─── getPublicGroups ─────────────────────────────────────────

  it('getPublicGroups() throws on error', async () => {
    mockRepo.findPublicGroups.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getPublicGroups()).rejects.toThrow(
      'No se pudieron cargar los grupos públicos',
    );
  });

  it('getPublicGroups() returns the groups from the repository', async () => {
    const group = fakeGroup({ id: 'public-1' });
    mockRepo.findPublicGroups.mockResolvedValue({ data: [group], error: null });
    const result = await service.getPublicGroups();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('public-1');
  });

  // ─── joinByCode ──────────────────────────────────────────────

  it('joinByCode() throws when invite code is invalid', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({ data: null, error: { message: 'not-found' } });
    await expect(service.joinByCode('INVALID', 'user-1')).rejects.toThrow(
      'Código de invitación inválido',
    );
  });

  it('joinByCode() throws when tournament is not active', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({
      data: fakeGroup({ tournament: { id: 'tour-1', name: 'Liga', status: 'closed' } }),
      error: null,
    });
    await expect(service.joinByCode('A3F9K2', 'user-1')).rejects.toThrow(
      'El torneo de este grupo no está activo',
    );
  });

  it('joinByCode() joins directly regardless of visibility (no approval flow)', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({
      data: fakeGroup({ visibility: 'private' }),
      error: null,
    });
    mockRepo.joinGroup.mockResolvedValue({ error: null });
    const result = await service.joinByCode('A3F9K2', 'user-2');
    expect(result.id).toBe('group-1');
    expect(mockRepo.joinGroup).toHaveBeenCalledWith('group-1', 'user-2');
  });

  it('joinByCode() throws on join error', async () => {
    mockRepo.findByInviteCode.mockResolvedValue({ data: fakeGroup(), error: null });
    mockRepo.joinGroup.mockResolvedValue({ error: { code: 'unknown', message: 'other' } });
    await expect(service.joinByCode('A3F9K2', 'user-2')).rejects.toThrow(
      'No se pudo unir al grupo',
    );
  });

  // ─── joinById ────────────────────────────────────────────────

  it('joinById() joins a known public group directly', async () => {
    mockRepo.findOne.mockResolvedValue({ data: fakeGroup(), error: null });
    mockRepo.joinGroup.mockResolvedValue({ error: null });
    const result = await service.joinById('group-1', 'user-2');
    expect(result.id).toBe('group-1');
    expect(mockRepo.joinGroup).toHaveBeenCalledWith('group-1', 'user-2');
  });

  // ─── create ──────────────────────────────────────────────────
  // El alta del líder como miembro activo la hace la Cloud Function
  // onGroupCreate (trigger) — el repo ya devuelve el grupo completo, no hace
  // falta un paso addMember + getOne del lado del cliente.

  it('create() throws on error', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(
      service.create({ name: 'G', tournament_id: 't', visibility: 'public' }, 'user-1'),
    ).rejects.toThrow('No se pudo crear el grupo');
  });

  it('create() returns the group from the repository', async () => {
    const group = fakeGroup({ id: 'new-group-id' });
    mockRepo.create.mockResolvedValue({ data: group, error: null });

    const result = await service.create(
      { name: 'G', tournament_id: 't', visibility: 'public' },
      'user-1',
    );

    expect(mockRepo.create).toHaveBeenCalledWith(
      { name: 'G', tournament_id: 't', visibility: 'public' },
      'user-1',
    );
    expect(result.id).toBe('new-group-id');
  });

  // ─── removeMember ────────────────────────────────────────────

  it('removeMember() throws on error', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.removeMember('member-1', 'group-1')).rejects.toThrow(
      'No se pudo remover el miembro',
    );
  });

  it('removeMember() calls updateMemberStatus with removed', async () => {
    mockRepo.updateMemberStatus.mockResolvedValue({ error: null });
    await service.removeMember('member-1', 'group-1');
    expect(mockRepo.updateMemberStatus).toHaveBeenCalledWith('group-1', 'member-1', 'removed');
  });
});

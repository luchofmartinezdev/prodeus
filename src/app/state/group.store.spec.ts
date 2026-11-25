import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GroupStore } from './group.store';
import { GroupService } from '../core/services/group.service';
import { AuthStore } from './auth.store';
import { ToastService } from '../core/services/toast.service';
import type { GroupWithTournament, MemberWithProfile } from '../data/repositories/group.repository';
import type { AuthUser as User } from './auth.store';

const mockGroupService = {
  getMyGroups: vi.fn(),
  getPublicGroups: vi.fn(),
  getOne: vi.fn(),
  getMembers: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  joinByCode: vi.fn(),
  joinById: vi.fn(),
  removeMember: vi.fn(),
};

const mockRouter = { navigate: vi.fn() };

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  toasts: signal([]),
};

const fakeUser = { id: 'user-1' } as User;

const mockAuthStore = {
  user: signal<User | null>(fakeUser),
  profile: signal(null),
  isAuthenticated: signal(true),
  isSuperadmin: signal(false),
  signOut: vi.fn(),
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

const fakeMember = (status: 'active' | 'removed'): MemberWithProfile =>
  ({
    id: 'member-1',
    group_id: 'group-1',
    user_id: 'user-2',
    status,
    joined_at: null,
    profile: { id: 'user-2', username: 'test', avatar_url: null },
  }) as unknown as MemberWithProfile;

describe('GroupStore', () => {
  let store: InstanceType<typeof GroupStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        GroupStore,
        { provide: GroupService, useValue: mockGroupService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    store = TestBed.inject(GroupStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── Initial state ────────────────────────────────────────────

  it('starts with empty groups and isLoading false', () => {
    expect(store.groups()).toEqual([]);
    expect(store.publicGroups()).toEqual([]);
    expect(store.isLoading()).toBe(false);
    expect(store.members()).toEqual([]);
  });

  // ─── Computed ─────────────────────────────────────────────────

  it('activeMembers filters members with status active', async () => {
    mockGroupService.getMembers.mockResolvedValue([
      fakeMember('active'),
      fakeMember('active'),
      fakeMember('removed'),
    ]);
    await store.loadMembers('group-1');
    expect(store.activeMembers()).toHaveLength(2);
  });

  // ─── loadMyGroups ─────────────────────────────────────────────

  it('loadMyGroups() sets groups and clears loading on success', async () => {
    const groups = [fakeGroup()];
    mockGroupService.getMyGroups.mockResolvedValue(groups);
    await store.loadMyGroups();
    expect(store.groups()).toEqual(groups);
    expect(store.isLoading()).toBe(false);
  });

  it('loadMyGroups() returns early without calling service when userId is null', async () => {
    mockAuthStore.user = signal(null);
    await store.loadMyGroups();
    expect(mockGroupService.getMyGroups).not.toHaveBeenCalled();
    // Restore
    mockAuthStore.user = signal(fakeUser);
  });

  it('loadMyGroups() shows toast.error and clears loading on failure', async () => {
    mockGroupService.getMyGroups.mockRejectedValue(new Error('No se pudieron cargar tus grupos'));
    await store.loadMyGroups();
    expect(mockToast.error).toHaveBeenCalledWith('No se pudieron cargar tus grupos');
    expect(store.isLoading()).toBe(false);
  });

  // ─── loadPublicGroups / joinPublicGroup ───────────────────────

  it('loadPublicGroups() sets publicGroups on success', async () => {
    const groups = [fakeGroup({ id: 'public-1' })];
    mockGroupService.getPublicGroups.mockResolvedValue(groups);
    await store.loadPublicGroups();
    expect(store.publicGroups()).toEqual(groups);
    expect(store.isLoadingPublic()).toBe(false);
  });

  it('joinPublicGroup() moves the group from publicGroups to groups', async () => {
    const group = fakeGroup({ id: 'public-1' });
    mockGroupService.getPublicGroups.mockResolvedValue([group]);
    await store.loadPublicGroups();

    mockGroupService.joinById.mockResolvedValue(group);
    const ok = await store.joinPublicGroup('public-1');

    expect(ok).toBe(true);
    expect(store.groups()).toContain(group);
    expect(store.publicGroups()).not.toContain(group);
    expect(mockToast.success).toHaveBeenCalledWith('Te uniste al grupo exitosamente');
  });

  // ─── create ───────────────────────────────────────────────────

  it('create() adds group to beginning of list on success', async () => {
    const existing = fakeGroup({ id: 'existing' });
    mockGroupService.getMyGroups.mockResolvedValue([existing]);
    await store.loadMyGroups();

    const newGroup = fakeGroup({ id: 'new-group' });
    mockGroupService.create.mockResolvedValue(newGroup);
    await store.create({ name: 'G', tournament_id: 't', visibility: 'public' });

    expect(store.groups()[0].id).toBe('new-group');
    expect(store.groups()).toHaveLength(2);
  });

  it('create() shows toast.success and navigates to group', async () => {
    const newGroup = fakeGroup({ id: 'new-group' });
    mockGroupService.create.mockResolvedValue(newGroup);
    await store.create({ name: 'G', tournament_id: 't', visibility: 'public' });
    expect(mockToast.success).toHaveBeenCalledWith('Grupo creado exitosamente');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home/groups', 'new-group']);
  });

  it('create() shows toast.error and clears loading on failure', async () => {
    mockGroupService.create.mockRejectedValue(new Error('No se pudo crear el grupo'));
    await store.create({ name: 'G', tournament_id: 't', visibility: 'public' });
    expect(mockToast.error).toHaveBeenCalledWith('No se pudo crear el grupo');
    expect(store.isLoading()).toBe(false);
  });

  // ─── joinByCode ──────────────────────────────────────────────

  it('joinByCode() adds group to list and shows success', async () => {
    const group = fakeGroup();
    mockGroupService.joinByCode.mockResolvedValue(group);
    const ok = await store.joinByCode('A3F9K2');
    expect(ok).toBe(true);
    expect(store.groups()).toContain(group);
    expect(mockToast.success).toHaveBeenCalledWith('Te uniste al grupo exitosamente');
  });

  it('joinByCode() returns false and shows error on failure', async () => {
    mockGroupService.joinByCode.mockRejectedValue(new Error('Código inválido'));
    const ok = await store.joinByCode('BAD');
    expect(ok).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith('Código inválido');
    expect(store.isLoading()).toBe(false);
  });

  // ─── update ───────────────────────────────────────────────────

  it('update() replaces group in list and shows toast', async () => {
    const original = fakeGroup();
    mockGroupService.getMyGroups.mockResolvedValue([original]);
    await store.loadMyGroups();

    const updated = fakeGroup({ name: 'Renombrado' });
    mockGroupService.update.mockResolvedValue(updated);
    await store.update('group-1', { name: 'Renombrado' });

    expect(store.groups()[0].name).toBe('Renombrado');
    expect(mockToast.success).toHaveBeenCalledWith('Grupo actualizado');
  });

  // ─── remove ───────────────────────────────────────────────────

  it('remove() removes group from list and navigates', async () => {
    const groups = [fakeGroup({ id: 'a' }), fakeGroup({ id: 'b' })];
    mockGroupService.getMyGroups.mockResolvedValue(groups);
    await store.loadMyGroups();

    mockGroupService.remove.mockResolvedValue(undefined);
    await store.remove('a');

    expect(store.groups()).toHaveLength(1);
    expect(store.groups()[0].id).toBe('b');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home/groups']);
  });
});

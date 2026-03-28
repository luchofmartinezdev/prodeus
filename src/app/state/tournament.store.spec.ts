import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentStore } from './tournament.store';
import { TournamentRepository } from '../data/repositories/tournament.repository';
import { ToastService } from '../core/services/toast.service';
import type { Tournament } from '../data/database.types';

const mockRepo = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  changeStatus: vi.fn(),
  remove: vi.fn(),
  createDefaultRules: vi.fn(),
};

const mockRouter = { navigate: vi.fn() };

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  toasts: signal([]),
};

const fakeTournament = (overrides: Partial<Tournament> = {}): Tournament =>
  ({
    id: 'tour-1',
    name: 'Liga 2025',
    status: 'draft',
    start_date: '2025-06-01',
    end_date: '2025-12-01',
    description: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }) as unknown as Tournament;

describe('TournamentStore', () => {
  let store: InstanceType<typeof TournamentStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TournamentStore,
        { provide: TournamentRepository, useValue: mockRepo },
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    store = TestBed.inject(TournamentStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── Initial state ────────────────────────────────────────────

  it('starts with empty tournaments and isLoading false', () => {
    expect(store.tournaments()).toEqual([]);
    expect(store.isLoading()).toBe(false);
  });

  // ─── Computed ─────────────────────────────────────────────────

  it('activeTournaments filters by active status', async () => {
    const data = [
      fakeTournament({ id: '1', status: 'active' }),
      fakeTournament({ id: '2', status: 'draft' }),
      fakeTournament({ id: '3', status: 'active' }),
    ];
    mockRepo.findAll.mockResolvedValue({ data, error: null });
    await store.loadAll();
    expect(store.activeTournaments()).toHaveLength(2);
  });

  it('draftTournaments filters by draft status', async () => {
    const data = [
      fakeTournament({ id: '1', status: 'draft' }),
      fakeTournament({ id: '2', status: 'closed' }),
    ];
    mockRepo.findAll.mockResolvedValue({ data, error: null });
    await store.loadAll();
    expect(store.draftTournaments()).toHaveLength(1);
    expect(store.draftTournaments()[0].id).toBe('1');
  });

  it('closedTournaments filters by closed status', async () => {
    const data = [
      fakeTournament({ id: '1', status: 'closed' }),
      fakeTournament({ id: '2', status: 'active' }),
    ];
    mockRepo.findAll.mockResolvedValue({ data, error: null });
    await store.loadAll();
    expect(store.closedTournaments()).toHaveLength(1);
  });

  // ─── loadAll ──────────────────────────────────────────────────

  it('loadAll() sets tournaments from repo', async () => {
    const data = [fakeTournament()];
    mockRepo.findAll.mockResolvedValue({ data, error: null });
    await store.loadAll();
    expect(store.tournaments()).toEqual(data);
    expect(store.isLoading()).toBe(false);
  });

  it('loadAll() calls toast.error on failure', async () => {
    mockRepo.findAll.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await store.loadAll();
    expect(mockToast.error).toHaveBeenCalledWith('No se pudieron cargar los torneos');
    expect(store.isLoading()).toBe(false);
  });

  // ─── create ───────────────────────────────────────────────────

  it('create() returns the new tournament id', async () => {
    const tour = fakeTournament({ id: 'new-id' });
    mockRepo.create.mockResolvedValue({ data: tour, error: null });
    mockRepo.createDefaultRules.mockResolvedValue({});
    const id = await store.create({
      name: 'Liga',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
    });
    expect(id).toBe('new-id');
  });

  it('create() adds tournament to beginning of list', async () => {
    const existing = fakeTournament({ id: 'existing' });
    mockRepo.findAll.mockResolvedValue({ data: [existing], error: null });
    await store.loadAll();

    const newTour = fakeTournament({ id: 'new-id' });
    mockRepo.create.mockResolvedValue({ data: newTour, error: null });
    mockRepo.createDefaultRules.mockResolvedValue({});
    await store.create({ name: 'Liga', start_date: '2025-01-01', end_date: '2025-12-31' });

    expect(store.tournaments()[0].id).toBe('new-id');
  });

  it('create() calls createDefaultRules', async () => {
    const tour = fakeTournament({ id: 'new-id' });
    mockRepo.create.mockResolvedValue({ data: tour, error: null });
    mockRepo.createDefaultRules.mockResolvedValue({});
    await store.create({ name: 'Liga', start_date: '2025-01-01', end_date: '2025-12-31' });
    expect(mockRepo.createDefaultRules).toHaveBeenCalledWith('new-id');
  });

  it('create() returns null on error', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const id = await store.create({
      name: 'Liga',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
    });
    expect(id).toBeNull();
    expect(mockToast.error).toHaveBeenCalled();
  });

  // ─── update ───────────────────────────────────────────────────

  it('update() replaces tournament in list', async () => {
    const original = fakeTournament();
    mockRepo.findAll.mockResolvedValue({ data: [original], error: null });
    await store.loadAll();

    const updated = fakeTournament({ name: 'Liga actualizada' });
    mockRepo.update.mockResolvedValue({ data: updated, error: null });
    await store.update('tour-1', { name: 'Liga actualizada' });

    expect(store.tournaments()[0].name).toBe('Liga actualizada');
    expect(mockToast.success).toHaveBeenCalledWith('Torneo actualizado');
  });

  it('update() returns false and shows error on failure', async () => {
    mockRepo.update.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const result = await store.update('tour-1', { name: 'X' });
    expect(result).toBe(false);
    expect(mockToast.error).toHaveBeenCalled();
  });

  // ─── changeStatus ─────────────────────────────────────────────

  it('changeStatus() updates status in list', async () => {
    const tour = fakeTournament({ status: 'draft' });
    mockRepo.findAll.mockResolvedValue({ data: [tour], error: null });
    await store.loadAll();

    const activated = fakeTournament({ status: 'active' });
    mockRepo.changeStatus.mockResolvedValue({ data: activated, error: null });
    await store.changeStatus('tour-1', 'active');

    expect(store.tournaments()[0].status).toBe('active');
  });

  it('changeStatus() shows toast with correct label', async () => {
    mockRepo.changeStatus.mockResolvedValue({
      data: fakeTournament({ status: 'active' }),
      error: null,
    });
    await store.changeStatus('tour-1', 'active');
    expect(mockToast.success).toHaveBeenCalledWith('Estado cambiado a Activo');
  });

  it('changeStatus() shows correct label for closed', async () => {
    mockRepo.changeStatus.mockResolvedValue({
      data: fakeTournament({ status: 'closed' }),
      error: null,
    });
    await store.changeStatus('tour-1', 'closed');
    expect(mockToast.success).toHaveBeenCalledWith('Estado cambiado a Cerrado');
  });

  it('changeStatus() shows error on failure', async () => {
    mockRepo.changeStatus.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await store.changeStatus('tour-1', 'active');
    expect(mockToast.error).toHaveBeenCalledWith('No se pudo cambiar el estado');
  });

  // ─── remove ───────────────────────────────────────────────────

  it('remove() removes tournament from list', async () => {
    const tours = [fakeTournament({ id: 'a' }), fakeTournament({ id: 'b' })];
    mockRepo.findAll.mockResolvedValue({ data: tours, error: null });
    await store.loadAll();

    mockRepo.remove.mockResolvedValue({ error: null });
    await store.remove('a');

    expect(store.tournaments()).toHaveLength(1);
    expect(store.tournaments()[0].id).toBe('b');
  });

  it('remove() navigates to /admin/tournaments', async () => {
    mockRepo.remove.mockResolvedValue({ error: null });
    await store.remove('tour-1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/tournaments']);
  });

  it('remove() shows error and does not navigate on failure', async () => {
    mockRepo.remove.mockResolvedValue({ error: { message: 'fail' } });
    await store.remove('tour-1');
    expect(mockToast.error).toHaveBeenCalledWith('No se pudo eliminar el torneo');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});

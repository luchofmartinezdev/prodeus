import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TournamentListComponent } from './tournament-list.component';
import { TournamentStore } from '../../../../state/tournament.store';
import type { Tournament } from '../../../../data/database.types';

const mockStore = {
  tournaments: signal<Tournament[]>([]),
  isLoading: signal(false),
  selected: signal(null),
  activeTournaments: signal([]),
  draftTournaments: signal([]),
  closedTournaments: signal([]),
  loadAll: vi.fn(),
  loadOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  changeStatus: vi.fn(),
  remove: vi.fn(),
  clearError: vi.fn(),
};

describe('TournamentListComponent', () => {
  let component: TournamentListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TournamentListComponent,
        { provide: TournamentStore, useValue: mockStore },
      ],
    });
    component = TestBed.inject(TournamentListComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── statusLabel ──────────────────────────────────────────────

  it('statusLabel() returns Borrador for draft', () => {
    expect(component.statusLabel('draft')).toBe('Borrador');
  });

  it('statusLabel() returns Activo for active', () => {
    expect(component.statusLabel('active')).toBe('Activo');
  });

  it('statusLabel() returns Cerrado for closed', () => {
    expect(component.statusLabel('closed')).toBe('Cerrado');
  });

  // ─── statusClass ──────────────────────────────────────────────

  it('statusClass() includes gray colors for draft', () => {
    const cls = component.statusClass('draft');
    expect(cls).toContain('gray');
  });

  it('statusClass() includes green colors for active', () => {
    const cls = component.statusClass('active');
    expect(cls).toContain('green');
  });

  it('statusClass() includes red colors for closed', () => {
    const cls = component.statusClass('closed');
    expect(cls).toContain('red');
  });

  // ─── onChangeStatus ───────────────────────────────────────────

  it('onChangeStatus() transitions draft → active', async () => {
    await component.onChangeStatus('tour-1', 'draft');
    expect(mockStore.changeStatus).toHaveBeenCalledWith('tour-1', 'active');
  });

  it('onChangeStatus() transitions active → closed', async () => {
    await component.onChangeStatus('tour-1', 'active');
    expect(mockStore.changeStatus).toHaveBeenCalledWith('tour-1', 'closed');
  });

  it('onChangeStatus() transitions closed → draft', async () => {
    await component.onChangeStatus('tour-1', 'closed');
    expect(mockStore.changeStatus).toHaveBeenCalledWith('tour-1', 'draft');
  });

  // ─── ngOnInit ────────────────────────────────────────────────

  it('ngOnInit() calls store.loadAll()', () => {
    component.ngOnInit();
    expect(mockStore.loadAll).toHaveBeenCalledTimes(1);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { PredictionsComponent, type MatchRow } from './predictions.component';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchService } from '../../../core/services/match.service';
import { GroupService } from '../../../core/services/group.service';
import { AuthStore } from '../../../state/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { RouterLink } from '@angular/router';
import type { Prediction } from '../../../data/database.types';
import type { AuthUser as User } from '../../../state/auth.store';

const mockPredictionService = { getByGroup: vi.fn(), save: vi.fn() };
const mockMatchService = { getByTournament: vi.fn() };
const mockGroupService = { getOne: vi.fn() };
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), toasts: signal([]) };
const mockAuthStore = {
  user: signal<User | null>({ id: 'user-1' } as User),
  isLoading: signal(false),
  isAuthenticated: signal(true),
  isSuperadmin: signal(false),
};

const fakeMatchRow = (overrides: Partial<MatchRow> = {}): MatchRow =>
  ({
    id: 'match-1',
    tournament_id: 'tour-1',
    home_team_id: 'h',
    away_team_id: 'a',
    home_team: { id: 'h', name: 'Local', short_name: 'LOC' },
    away_team: { id: 'a', name: 'Visita', short_name: 'VIS' },
    match_date: new Date().toISOString(),
    prediction_deadline: new Date(Date.now() + 3_600_000).toISOString(),
    status: 'scheduled',
    home_score: null,
    away_score: null,
    round: 'Jornada 1',
    prediction: null,
    isOpen: true,
    ...overrides,
  }) as unknown as MatchRow;

const fakePrediction: Prediction = {
  id: 'pred-1',
  user_id: 'user-1',
  group_id: 'group-1',
  match_id: 'match-1',
  predicted_home: 2,
  predicted_away: 0,
  points_earned: null,
  created_at: new Date().toISOString(),
} as unknown as Prediction;

describe('PredictionsComponent', () => {
  let component: PredictionsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PredictionsComponent,
        { provide: PredictionService, useValue: mockPredictionService },
        { provide: MatchService, useValue: mockMatchService },
        { provide: GroupService, useValue: mockGroupService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ToastService, useValue: mockToast },
        { provide: RouterLink, useValue: {} },
      ],
    });
    component = TestBed.inject(PredictionsComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── predictedCount ───────────────────────────────────────────

  it('predictedCount returns count of rows with non-null prediction', () => {
    component.rows.set([
      fakeMatchRow({ prediction: fakePrediction }),
      fakeMatchRow({ id: 'match-2', prediction: null }),
      fakeMatchRow({ id: 'match-3', prediction: fakePrediction }),
    ]);
    expect(component.predictedCount()).toBe(2);
  });

  it('predictedCount returns 0 when no predictions', () => {
    component.rows.set([fakeMatchRow(), fakeMatchRow({ id: 'match-2' })]);
    expect(component.predictedCount()).toBe(0);
  });

  // ─── openCount ────────────────────────────────────────────────

  it('openCount returns count of rows where isOpen is true', () => {
    component.rows.set([
      fakeMatchRow({ isOpen: true }),
      fakeMatchRow({ id: 'match-2', isOpen: false }),
      fakeMatchRow({ id: 'match-3', isOpen: true }),
    ]);
    expect(component.openCount()).toBe(2);
  });

  // ─── isSaving / isSaved ───────────────────────────────────────

  it('isSaving() returns true when matchId is in saving set', () => {
    component.saving.set(new Set(['match-1']));
    expect(component.isSaving('match-1')).toBe(true);
    expect(component.isSaving('match-2')).toBe(false);
  });

  it('isSaved() returns true when matchId is in saved set', () => {
    component.saved.set(new Set(['match-1']));
    expect(component.isSaved('match-1')).toBe(true);
    expect(component.isSaved('match-9')).toBe(false);
  });

  // ─── hasPrediction ────────────────────────────────────────────

  it('hasPrediction() returns true when prediction is not null', () => {
    expect(component.hasPrediction(fakeMatchRow({ prediction: fakePrediction }))).toBe(true);
  });

  it('hasPrediction() returns false when prediction is null', () => {
    expect(component.hasPrediction(fakeMatchRow({ prediction: null }))).toBe(false);
  });

  // ─── rounds getter ────────────────────────────────────────────

  it('rounds getter groups matches by round', () => {
    component.rows.set([
      fakeMatchRow({ id: 'm1', round: 'Jornada 1' }),
      fakeMatchRow({ id: 'm2', round: 'Jornada 2' }),
      fakeMatchRow({ id: 'm3', round: 'Jornada 1' }),
    ]);
    const rounds = component.rounds;
    expect(rounds).toHaveLength(2);
    expect(rounds[0].label).toBe('Jornada 1');
    expect(rounds[0].rows).toHaveLength(2);
    expect(rounds[1].label).toBe('Jornada 2');
    expect(rounds[1].rows).toHaveLength(1);
  });

  it('rounds getter uses "Sin jornada" for null round', () => {
    component.rows.set([fakeMatchRow({ round: null })]);
    const rounds = component.rounds;
    expect(rounds[0].label).toBe('Sin jornada');
  });

  it('rounds getter preserves insertion order', () => {
    component.rows.set([
      fakeMatchRow({ id: 'm1', round: 'Jornada 3' }),
      fakeMatchRow({ id: 'm2', round: 'Jornada 1' }),
      fakeMatchRow({ id: 'm3', round: 'Jornada 2' }),
    ]);
    const labels = component.rounds.map((r) => r.label);
    expect(labels).toEqual(['Jornada 3', 'Jornada 1', 'Jornada 2']);
  });

  // ─── formatDate ───────────────────────────────────────────────

  it('formatDate() returns a non-empty localized string', () => {
    const result = component.formatDate(new Date('2025-06-15T20:00:00').toISOString());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

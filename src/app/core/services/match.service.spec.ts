import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatchService } from './match.service';
import { MatchRepository } from '../../data/repositories/match.repository';

const mockRepo = {
  findByTournament: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  loadResult: vi.fn(),
  remove: vi.fn(),
  scoreMatch: vi.fn(),
};

describe('MatchService', () => {
  let service: MatchService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MatchService,
        { provide: MatchRepository, useValue: mockRepo },
      ],
    });
    service = TestBed.inject(MatchService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── getByTournament ─────────────────────────────────────────

  it('getByTournament() throws on error', async () => {
    mockRepo.findByTournament.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getByTournament('tour-1')).rejects.toThrow(
      'No se pudieron cargar los partidos',
    );
  });

  it('getByTournament() returns matches on success', async () => {
    const matches = [{ id: 'match-1' }];
    mockRepo.findByTournament.mockResolvedValue({ data: matches, error: null });
    const result = await service.getByTournament('tour-1');
    expect(result).toEqual(matches);
  });

  // ─── create ──────────────────────────────────────────────────

  it('create() resolves on success', async () => {
    mockRepo.create.mockResolvedValue({ data: {}, error: null });
    await expect(
      service.create({
        tournament_id: 't',
        home_team_id: 'h',
        away_team_id: 'a',
        match_date: '2025-06-01T20:00',
        prediction_deadline: '2025-06-01T19:00',
      }),
    ).resolves.toBeUndefined();
  });

  it('create() throws friendly message when teams are equal', async () => {
    mockRepo.create.mockResolvedValue({
      data: null,
      error: { message: 'different_teams constraint violated' },
    });
    await expect(
      service.create({
        tournament_id: 't',
        home_team_id: 'same',
        away_team_id: 'same',
        match_date: '2025-06-01T20:00',
        prediction_deadline: '2025-06-01T19:00',
      }),
    ).rejects.toThrow('Los equipos no pueden ser iguales');
  });

  it('create() throws generic error on other DB errors', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { message: 'other error' } });
    await expect(
      service.create({
        tournament_id: 't',
        home_team_id: 'h',
        away_team_id: 'a',
        match_date: '2025-06-01T20:00',
        prediction_deadline: '2025-06-01T19:00',
      }),
    ).rejects.toThrow('No se pudo crear el partido');
  });

  // ─── loadResult ──────────────────────────────────────────────

  it('loadResult() calls scoreMatch asynchronously (fire-and-forget)', async () => {
    mockRepo.loadResult.mockResolvedValue({ error: null });
    mockRepo.scoreMatch.mockResolvedValue({});
    await service.loadResult('match-1', { home_score: 2, away_score: 1 });
    // scoreMatch is called but not awaited — just verify it was called
    expect(mockRepo.scoreMatch).toHaveBeenCalledWith('match-1');
  });

  it('loadResult() resolves even if scoreMatch fails', async () => {
    mockRepo.loadResult.mockResolvedValue({ error: null });
    mockRepo.scoreMatch.mockRejectedValue(new Error('scoring failed'));
    await expect(
      service.loadResult('match-1', { home_score: 1, away_score: 1 }),
    ).resolves.toBeUndefined();
  });

  it('loadResult() throws when repo returns error', async () => {
    mockRepo.loadResult.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.loadResult('match-1', { home_score: 0, away_score: 0 })).rejects.toThrow(
      'No se pudo cargar el resultado',
    );
  });

  // ─── remove ──────────────────────────────────────────────────

  it('remove() resolves on success', async () => {
    mockRepo.remove.mockResolvedValue({ error: null });
    await expect(service.remove('match-1')).resolves.toBeUndefined();
  });

  it('remove() throws on error', async () => {
    mockRepo.remove.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.remove('match-1')).rejects.toThrow('No se pudo eliminar el partido');
  });
});

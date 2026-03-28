import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ScoringRulesService } from './scoring-rules.service';
import { ScoringRulesRepository } from '../../data/repositories/scoring-rules.repository';
import type { ScoringRule } from '../../data/database.types';

const mockRepo = {
  findAll: vi.fn(),
  findByTournament: vi.fn(),
  update: vi.fn(),
};

const fakeRule = (overrides: Partial<ScoringRule> = {}): ScoringRule =>
  ({
    id: 'rule-1',
    rule_key: 'exact_score',
    points_value: 5,
    description: 'Exacto',
    created_at: new Date().toISOString(),
    ...overrides,
  }) as unknown as ScoringRule;

describe('ScoringRulesService', () => {
  let service: ScoringRulesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ScoringRulesService,
        { provide: ScoringRulesRepository, useValue: mockRepo },
      ],
    });
    service = TestBed.inject(ScoringRulesService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── getAll ──────────────────────────────────────────────────

  it('getAll() returns rules on success', async () => {
    const rules = [
      fakeRule(),
      fakeRule({ id: 'rule-2', rule_key: 'correct_winner', points_value: 3 }),
    ];
    mockRepo.findAll.mockResolvedValue({ data: rules, error: null });
    const result = await service.getAll();
    expect(result).toEqual(rules);
  });

  it('getAll() returns empty array when data is null', async () => {
    mockRepo.findAll.mockResolvedValue({ data: null, error: null });
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  it('getAll() throws on error', async () => {
    mockRepo.findAll.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getAll()).rejects.toThrow(
      'No se pudieron cargar las reglas de puntuación',
    );
  });

  // ─── getByTournament ─────────────────────────────────────────

  it('getByTournament() returns rules for a tournament', async () => {
    const rules = [fakeRule()];
    mockRepo.findByTournament.mockResolvedValue({ data: rules, error: null });
    const result = await service.getByTournament('tour-1');
    expect(result).toEqual(rules);
  });

  it('getByTournament() throws on error', async () => {
    mockRepo.findByTournament.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getByTournament('tour-1')).rejects.toThrow(
      'No se pudieron cargar las reglas de puntuación',
    );
  });

  // ─── update ──────────────────────────────────────────────────

  it('update() returns updated rule on success', async () => {
    const updated = fakeRule({ points_value: 10 });
    mockRepo.update.mockResolvedValue({ data: updated, error: null });
    const result = await service.update('rule-1', 10);
    expect(result.points_value).toBe(10);
  });

  it('update() throws on error', async () => {
    mockRepo.update.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.update('rule-1', 10)).rejects.toThrow('No se pudo actualizar la regla');
  });
});

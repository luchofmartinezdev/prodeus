import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PredictionService } from './prediction.service';
import { PredictionRepository } from '../../data/repositories/prediction.repository';
import type { Prediction } from '../../data/database.types';

const mockRepo = {
  findByGroup: vi.fn(),
  upsert: vi.fn(),
};

const fakePrediction: Prediction = {
  id: 'pred-1',
  user_id: 'user-1',
  group_id: 'group-1',
  match_id: 'match-1',
  predicted_home: 2,
  predicted_away: 1,
  points_earned: null,
  created_at: new Date().toISOString(),
} as unknown as Prediction;

describe('PredictionService', () => {
  let service: PredictionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PredictionService,
        { provide: PredictionRepository, useValue: mockRepo },
      ],
    });
    service = TestBed.inject(PredictionService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── getByGroup ───────────────────────────────────────────────

  it('getByGroup() returns predictions on success', async () => {
    mockRepo.findByGroup.mockResolvedValue({ data: [fakePrediction], error: null });
    const result = await service.getByGroup('group-1', 'user-1');
    expect(result).toEqual([fakePrediction]);
  });

  it('getByGroup() returns empty array when data is null', async () => {
    mockRepo.findByGroup.mockResolvedValue({ data: null, error: null });
    const result = await service.getByGroup('group-1', 'user-1');
    expect(result).toEqual([]);
  });

  it('getByGroup() throws on error', async () => {
    mockRepo.findByGroup.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getByGroup('group-1', 'user-1')).rejects.toThrow(
      'No se pudieron cargar las predicciones',
    );
  });

  // ─── save ─────────────────────────────────────────────────────

  it('save() throws when deadline has passed', async () => {
    const pastDeadline = new Date(Date.now() - 60_000).toISOString();
    await expect(
      service.save(
        { group_id: 'g', user_id: 'u', match_id: 'm', predicted_home: 1, predicted_away: 0 },
        pastDeadline,
      ),
    ).rejects.toThrow('El deadline para este partido ya pasó');
    expect(mockRepo.upsert).not.toHaveBeenCalled();
  });

  it('save() calls repo.upsert when deadline is in the future', async () => {
    const futureDeadline = new Date(Date.now() + 60_000).toISOString();
    mockRepo.upsert.mockResolvedValue({ data: fakePrediction, error: null });
    const dto = {
      group_id: 'g',
      user_id: 'u',
      match_id: 'm',
      predicted_home: 1,
      predicted_away: 0,
    };
    await service.save(dto, futureDeadline);
    expect(mockRepo.upsert).toHaveBeenCalledWith(dto);
  });

  it('save() returns the saved prediction', async () => {
    const futureDeadline = new Date(Date.now() + 60_000).toISOString();
    mockRepo.upsert.mockResolvedValue({ data: fakePrediction, error: null });
    const result = await service.save(
      { group_id: 'g', user_id: 'u', match_id: 'm', predicted_home: 2, predicted_away: 1 },
      futureDeadline,
    );
    expect(result).toEqual(fakePrediction);
  });

  it('save() throws when repo returns error', async () => {
    const futureDeadline = new Date(Date.now() + 60_000).toISOString();
    mockRepo.upsert.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    await expect(
      service.save(
        { group_id: 'g', user_id: 'u', match_id: 'm', predicted_home: 0, predicted_away: 0 },
        futureDeadline,
      ),
    ).rejects.toThrow('No se pudo guardar la predicción');
  });
});

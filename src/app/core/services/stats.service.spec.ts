import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { StatsService } from './stats.service';
import { StatsRepository } from '../../data/repositories/stats.repository';

const mockRepo = {
  findActiveTournamentIds: vi.fn(),
  countTotalGroups: vi.fn(),
  countPredictions: vi.fn(),
  countActiveMembers: vi.fn(),
  countRegisteredUsers: vi.fn(),
  countTournamentsByStatus: vi.fn(),
  countGroupsByTournamentIds: vi.fn(),
};

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        StatsService,
        { provide: StatsRepository, useValue: mockRepo },
      ],
    });
    service = TestBed.inject(StatsService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  function setupDefaultMocks(activeTournamentIds: string[] = ['tour-1']) {
    mockRepo.findActiveTournamentIds.mockResolvedValue({
      data: activeTournamentIds.map((id) => ({ id })),
      error: null,
    });
    mockRepo.countTotalGroups.mockResolvedValue({ count: 10 });
    mockRepo.countPredictions.mockResolvedValue({ count: 250 });
    mockRepo.countActiveMembers.mockResolvedValue({ count: 45 });
    mockRepo.countRegisteredUsers.mockResolvedValue({ count: 30 });
    mockRepo.countTournamentsByStatus
      .mockResolvedValueOnce({ count: 1 }) // draft
      .mockResolvedValueOnce({ count: 2 }) // active
      .mockResolvedValueOnce({ count: 3 }); // closed
    mockRepo.countGroupsByTournamentIds.mockResolvedValue({ count: 7 });
  }

  it('getGlobalStats() returns a complete stats object', async () => {
    setupDefaultMocks();
    const stats = await service.getGlobalStats();

    expect(stats.totalGroups).toBe(10);
    expect(stats.totalPredictions).toBe(250);
    expect(stats.activeMembers).toBe(45);
    expect(stats.registeredUsers).toBe(30);
    expect(stats.activeGroups).toBe(7);
    expect(stats.tournamentsByStatus).toEqual({ draft: 1, active: 2, closed: 3 });
  });

  it('getGlobalStats() calls countGroupsByTournamentIds with active tournament ids', async () => {
    setupDefaultMocks(['tour-1', 'tour-2']);
    await service.getGlobalStats();
    expect(mockRepo.countGroupsByTournamentIds).toHaveBeenCalledWith(['tour-1', 'tour-2']);
  });

  it('getGlobalStats() passes empty array to countGroupsByTournamentIds when no active tournaments', async () => {
    setupDefaultMocks([]);
    await service.getGlobalStats();
    expect(mockRepo.countGroupsByTournamentIds).toHaveBeenCalledWith([]);
  });

  it('getGlobalStats() defaults null counts to 0', async () => {
    mockRepo.findActiveTournamentIds.mockResolvedValue({ data: [], error: null });
    mockRepo.countTotalGroups.mockResolvedValue({ count: null });
    mockRepo.countPredictions.mockResolvedValue({ count: null });
    mockRepo.countActiveMembers.mockResolvedValue({ count: null });
    mockRepo.countRegisteredUsers.mockResolvedValue({ count: null });
    mockRepo.countTournamentsByStatus.mockResolvedValue({ count: null });
    mockRepo.countGroupsByTournamentIds.mockResolvedValue({ count: null });

    const stats = await service.getGlobalStats();
    expect(stats.totalGroups).toBe(0);
    expect(stats.totalPredictions).toBe(0);
    expect(stats.activeGroups).toBe(0);
    expect(stats.tournamentsByStatus).toEqual({ draft: 0, active: 0, closed: 0 });
  });

  it('getGlobalStats() fires all independent queries in parallel (Promise.all)', async () => {
    setupDefaultMocks();
    await service.getGlobalStats();
    // All these should be called exactly once
    expect(mockRepo.findActiveTournamentIds).toHaveBeenCalledTimes(1);
    expect(mockRepo.countTotalGroups).toHaveBeenCalledTimes(1);
    expect(mockRepo.countPredictions).toHaveBeenCalledTimes(1);
    expect(mockRepo.countActiveMembers).toHaveBeenCalledTimes(1);
    expect(mockRepo.countRegisteredUsers).toHaveBeenCalledTimes(1);
    expect(mockRepo.countTournamentsByStatus).toHaveBeenCalledTimes(3); // draft, active, closed
  });
});

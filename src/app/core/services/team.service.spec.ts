import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TeamService } from './team.service';
import { TeamRepository } from '../../data/repositories/team.repository';
import type { Team } from '../../data/database.types';

const mockRepo = {
  findByTournament: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const fakeTeam: Team = {
  id: 'team-1',
  tournament_id: 'tour-1',
  name: 'Argentina',
  short_name: 'ARG',
  logo_url: null,
  created_at: new Date().toISOString(),
} as unknown as Team;

describe('TeamService', () => {
  let service: TeamService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TeamService,
        { provide: TeamRepository, useValue: mockRepo },
      ],
    });
    service = TestBed.inject(TeamService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── getByTournament ─────────────────────────────────────────

  it('getByTournament() returns teams on success', async () => {
    mockRepo.findByTournament.mockResolvedValue({ data: [fakeTeam], error: null });
    const result = await service.getByTournament('tour-1');
    expect(result).toEqual([fakeTeam]);
  });

  it('getByTournament() returns empty array when data is null', async () => {
    mockRepo.findByTournament.mockResolvedValue({ data: null, error: null });
    const result = await service.getByTournament('tour-1');
    expect(result).toEqual([]);
  });

  it('getByTournament() throws on error', async () => {
    mockRepo.findByTournament.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getByTournament('tour-1')).rejects.toThrow(
      'No se pudieron cargar los equipos',
    );
  });

  // ─── create ──────────────────────────────────────────────────

  it('create() returns team on success', async () => {
    mockRepo.create.mockResolvedValue({ data: fakeTeam, error: null });
    const result = await service.create({ tournament_id: 'tour-1', name: 'Argentina' });
    expect(result).toEqual(fakeTeam);
  });

  it('create() throws friendly message on duplicate name (23505)', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { code: '23505' } });
    await expect(service.create({ tournament_id: 'tour-1', name: 'Argentina' })).rejects.toThrow(
      'Ya existe un equipo con ese nombre en el torneo',
    );
  });

  it('create() throws generic error on other DB errors', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { code: '99999', message: 'Other' } });
    await expect(service.create({ tournament_id: 'tour-1', name: 'Argentina' })).rejects.toThrow(
      'No se pudo crear el equipo',
    );
  });

  // ─── update ──────────────────────────────────────────────────

  it('update() returns updated team', async () => {
    const updated = { ...fakeTeam, name: 'Brasil' };
    mockRepo.update.mockResolvedValue({ data: updated, error: null });
    const result = await service.update('team-1', { name: 'Brasil' });
    expect(result.name).toBe('Brasil');
  });

  it('update() throws on error', async () => {
    mockRepo.update.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.update('team-1', { name: 'X' })).rejects.toThrow(
      'No se pudo actualizar el equipo',
    );
  });

  // ─── remove ──────────────────────────────────────────────────

  it('remove() resolves on success', async () => {
    mockRepo.remove.mockResolvedValue({ error: null });
    await expect(service.remove('team-1')).resolves.toBeUndefined();
  });

  it('remove() throws on error', async () => {
    mockRepo.remove.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.remove('team-1')).rejects.toThrow('No se pudo eliminar el equipo');
  });
});

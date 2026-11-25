import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TeamService } from './team.service';
import { TeamRepository } from '../../data/repositories/team.repository';
import type { Team } from '../../data/database.types';

const mockRepo = {
  findAll: vi.fn(),
  findByIds: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const fakeTeam: Team = {
  id: 'team-1',
  name: 'Argentina',
  short_name: 'ARG',
  logo_url: null,
  country: 'Argentina',
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

  // ─── getAll ──────────────────────────────────────────────────

  it('getAll() returns teams on success', async () => {
    mockRepo.findAll.mockResolvedValue({ data: [fakeTeam], error: null });
    const result = await service.getAll();
    expect(result).toEqual([fakeTeam]);
  });

  it('getAll() returns empty array when data is null', async () => {
    mockRepo.findAll.mockResolvedValue({ data: null, error: null });
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  it('getAll() throws on error', async () => {
    mockRepo.findAll.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.getAll()).rejects.toThrow('No se pudieron cargar los equipos');
  });

  // ─── create ──────────────────────────────────────────────────

  it('create() returns team on success', async () => {
    mockRepo.create.mockResolvedValue({ data: fakeTeam, error: null });
    const result = await service.create({ name: 'Argentina' });
    expect(result).toEqual(fakeTeam);
  });

  it('create() throws generic error on failure', async () => {
    mockRepo.create.mockResolvedValue({ data: null, error: { code: '99999', message: 'Other' } });
    await expect(service.create({ name: 'Argentina' })).rejects.toThrow(
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

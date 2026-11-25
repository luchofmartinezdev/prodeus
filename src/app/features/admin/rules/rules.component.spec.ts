import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { AdminRulesComponent } from './rules.component';
import { ScoringRulesService } from '../../../core/services/scoring-rules.service';
import { ToastService } from '../../../core/services/toast.service';
import type { ScoringRule } from '../../../data/repositories/scoring-rules.repository';

const mockRulesService = {
  getAll: vi.fn(),
  update: vi.fn(),
};

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  toasts: signal([]),
};

const fakeRule = (key: string, points: number, id = key): ScoringRule =>
  ({
    id,
    rule_key: key,
    points_value: points,
    description: null,
    created_at: new Date().toISOString(),
  }) as unknown as ScoringRule;

describe('AdminRulesComponent', () => {
  let component: AdminRulesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AdminRulesComponent,
        { provide: ScoringRulesService, useValue: mockRulesService },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    component = TestBed.inject(AdminRulesComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── ruleLabel ────────────────────────────────────────────────

  it('ruleLabel() returns correct label for correct_outcome', () => {
    expect(component.ruleLabel('correct_outcome')).toBe('Local, Empate o Visitante');
  });

  it('ruleLabel() returns correct label for home_goals', () => {
    expect(component.ruleLabel('home_goals')).toBe('Goles del local');
  });

  it('ruleLabel() returns correct label for away_goals', () => {
    expect(component.ruleLabel('away_goals')).toBe('Goles del visitante');
  });

  it('ruleLabel() returns the key itself for unknown keys', () => {
    expect(component.ruleLabel('some_unknown_key')).toBe('some_unknown_key');
  });

  // ─── ruleDescription ─────────────────────────────────────────

  it('ruleDescription() returns description for correct_outcome', () => {
    expect(component.ruleDescription('correct_outcome')).toContain('gana');
  });

  it('ruleDescription() returns description for home_goals', () => {
    expect(component.ruleDescription('home_goals')).toContain('local');
  });

  it('ruleDescription() returns description for away_goals', () => {
    expect(component.ruleDescription('away_goals')).toContain('visitante');
  });

  it('ruleDescription() returns empty string for unknown key', () => {
    expect(component.ruleDescription('unknown')).toBe('');
  });

  // ─── cancel ───────────────────────────────────────────────────

  it('cancel() resets ruleValues to original points and turns off editing', () => {
    const rules = [fakeRule('correct_outcome', 3, 'id-1'), fakeRule('home_goals', 1, 'id-2')];
    component.rules.set(rules);
    component.ruleValues = { 'id-1': 3, 'id-2': 1 };
    component.isEditing.set(true);

    // Simulate user edited the value
    component.ruleValues['id-1'] = 99;

    component.cancel();

    expect(component.ruleValues['id-1']).toBe(3);
    expect(component.ruleValues['id-2']).toBe(1);
    expect(component.isEditing()).toBe(false);
  });

  // ─── ngOnInit / load ─────────────────────────────────────────

  it('ngOnInit() loads rules and deduplicates by rule_key', async () => {
    const rules = [
      fakeRule('correct_outcome', 3, 'id-1'),
      fakeRule('correct_outcome', 3, 'id-2'), // duplicate key
      fakeRule('home_goals', 1, 'id-3'),
    ];
    mockRulesService.getAll.mockResolvedValue(rules);
    await component.ngOnInit();
    // Should deduplicate — only one correct_outcome
    expect(component.rules()).toHaveLength(2);
    expect(component.isLoading()).toBe(false);
  });

  it('ngOnInit() sorts rules by points descending', async () => {
    const rules = [
      fakeRule('home_goals', 1, 'id-1'),
      fakeRule('correct_outcome', 3, 'id-2'),
      fakeRule('away_goals', 1, 'id-3'),
    ];
    mockRulesService.getAll.mockResolvedValue(rules);
    await component.ngOnInit();
    const points = component.rules().map((r) => r.points_value);
    expect(points).toEqual([3, 1, 1]);
  });

  it('ngOnInit() shows error toast on failure', async () => {
    mockRulesService.getAll.mockRejectedValue(new Error('Error al cargar'));
    await component.ngOnInit();
    expect(mockToast.error).toHaveBeenCalledWith('Error al cargar');
    expect(component.isLoading()).toBe(false);
  });

  // ─── save ─────────────────────────────────────────────────────

  it('save() calls update for each rule and shows success toast', async () => {
    const rules = [fakeRule('correct_outcome', 3, 'id-1')];
    component.rules.set(rules);
    component.ruleValues = { 'id-1': 7 };
    mockRulesService.update.mockResolvedValue({ ...rules[0], points_value: 7 });
    mockRulesService.getAll.mockResolvedValue([{ ...rules[0], points_value: 7 }]);

    await component.save();

    expect(mockRulesService.update).toHaveBeenCalledWith('id-1', 7);
    expect(mockToast.success).toHaveBeenCalledWith('Reglas guardadas');
    expect(component.isEditing()).toBe(false);
  });
});

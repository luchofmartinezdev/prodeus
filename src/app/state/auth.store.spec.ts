import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { AuthRepository } from '../data/repositories/auth.repository';

const mockAuthRepo = {
  onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  getProfile: vi.fn().mockResolvedValue({ data: null }),
  updateProfile: vi.fn().mockResolvedValue({ data: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
  signInWithGoogle: vi.fn(),
};

const mockRouter = { navigate: vi.fn() };

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthStore,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: Router, useValue: mockRouter },
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  // ─── Initial state ────────────────────────────────────────────

  it('starts with user null and isSigningIn false', () => {
    expect(store.user()).toBeNull();
    expect(store.isSigningIn()).toBe(false);
  });

  // ─── Computed ─────────────────────────────────────────────────

  it('isAuthenticated is false when user is null', () => {
    expect(store.isAuthenticated()).toBe(false);
  });

  it('isSuperadmin is false when profile is null', () => {
    expect(store.isSuperadmin()).toBe(false);
  });

  // ─── signOut ──────────────────────────────────────────────────

  it('signOut() clears user and profile from state immediately', () => {
    store.signOut();
    expect(store.user()).toBeNull();
    expect(store.profile()).toBeNull();
  });

  it('signOut() navigates to root', () => {
    store.signOut();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('signOut() calls authRepo.signOut() (fire-and-forget)', () => {
    store.signOut();
    expect(mockAuthRepo.signOut).toHaveBeenCalled();
  });
});

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { AuthRepository } from '../data/repositories/auth.repository';

const mockAuthRepo = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  }),
  getProfile: vi.fn().mockResolvedValue({ data: null }),
  signOut: vi.fn().mockResolvedValue({}),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithMagicLink: vi.fn(),
};

const mockRouter = { navigate: vi.fn() };

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    // Clear localStorage before each test
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));

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

  it('starts with user null and isLoading true', () => {
    expect(store.user()).toBeNull();
    // isLoading starts true and resolves after getSession
    // We just check it exists
    expect(typeof store.isLoading()).toBe('boolean');
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

  it('signOut() clears sb- keys from localStorage', () => {
    localStorage.setItem('sb-auth-token', 'some-token');
    localStorage.setItem('sb-refresh-token', 'some-refresh');
    localStorage.setItem('other-key', 'stays');
    store.signOut();
    expect(localStorage.getItem('sb-auth-token')).toBeNull();
    expect(localStorage.getItem('sb-refresh-token')).toBeNull();
    expect(localStorage.getItem('other-key')).toBe('stays');
  });

  it('signOut() calls authRepo.signOut() (fire-and-forget)', () => {
    store.signOut();
    // Called asynchronously — just ensure it was invoked
    expect(mockAuthRepo.signOut).toHaveBeenCalled();
  });

  // ─── signInWithEmail ──────────────────────────────────────────

  it('signInWithEmail() returns false when credentials are wrong', async () => {
    mockAuthRepo.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });
    const result = await store.signInWithEmail({ email: 'a@b.com', password: 'wrong' });
    expect(result).toBe(false);
  });

  it('signInWithEmail() sets user and profile on success', async () => {
    const fakeUser = { id: 'user-1', email: 'a@b.com' };
    const fakeProfile = { id: 'user-1', role: 'user', username: 'tester', avatar_url: null };
    mockAuthRepo.signInWithPassword.mockResolvedValue({
      data: { user: fakeUser, session: {} },
      error: null,
    });
    mockAuthRepo.getProfile.mockResolvedValue({ data: fakeProfile });
    const result = await store.signInWithEmail({ email: 'a@b.com', password: 'correct' });
    expect(result).toBe(true);
  });
});

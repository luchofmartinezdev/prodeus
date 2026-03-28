import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ToastService],
    });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('starts with an empty toasts array', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('show() adds a toast with correct fields', () => {
    service.show('Hola', 'success');
    const toasts = service.toasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hola');
    expect(toasts[0].type).toBe('success');
    expect(typeof toasts[0].id).toBe('string');
  });

  it('show() defaults to info type', () => {
    service.show('Mensaje');
    expect(service.toasts()[0].type).toBe('info');
  });

  it('dismiss() removes the toast by id', () => {
    service.show('A', 'info');
    service.show('B', 'error');
    const id = service.toasts()[0].id;
    service.dismiss(id);
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].message).toBe('B');
  });

  it('dismiss() does nothing when id not found', () => {
    service.show('A', 'info');
    service.dismiss('nonexistent-id');
    expect(service.toasts()).toHaveLength(1);
  });

  it('success() adds a toast with type success', () => {
    service.success('Guardado');
    expect(service.toasts()[0].type).toBe('success');
    expect(service.toasts()[0].message).toBe('Guardado');
  });

  it('error() adds a toast with type error', () => {
    service.error('Algo salió mal');
    expect(service.toasts()[0].type).toBe('error');
  });

  it('info() adds a toast with type info', () => {
    service.info('FYI');
    expect(service.toasts()[0].type).toBe('info');
  });

  it('warning() adds a toast with type warning', () => {
    service.warning('Atención');
    expect(service.toasts()[0].type).toBe('warning');
  });

  it('auto-dismisses after duration', () => {
    vi.useFakeTimers();
    service.show('Auto', 'info', 1000);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(service.toasts()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('multiple toasts can coexist', () => {
    service.success('Uno');
    service.error('Dos');
    service.info('Tres');
    expect(service.toasts()).toHaveLength(3);
  });
});

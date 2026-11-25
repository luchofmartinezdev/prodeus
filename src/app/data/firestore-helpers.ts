import { Timestamp } from 'firebase/firestore';

export interface RepoError {
  code: string;
  message: string;
}
export interface RepoResult<T> {
  data: T | null;
  error: RepoError | null;
}

export function mapFirestoreError(e: unknown): RepoError {
  const err = e as { code?: string; message?: string };
  // Los repositorios envuelven este error en mensajes genéricos para la UI
  // (toasts) — sin este log, la causa real (permiso denegado, índice
  // faltante, etc.) queda invisible en desarrollo.
  console.error('[Firestore]', err.code, err.message);
  return { code: err.code ?? 'unknown', message: err.message ?? 'Error desconocido' };
}

/** Timestamp de Firestore | Date | ISO string | null → ISO string (o '' si no hay valor) */
export function tsToIso(v: unknown): string {
  if (!v) return '';
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return '';
}

/** ISO string → Timestamp de Firestore, para escribir campos de fecha */
export function isoToTs(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso));
}

/** Rechaza con AbortError si `signal` se aborta antes de que `promise` resuelva. */
export function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

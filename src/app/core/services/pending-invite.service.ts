import { Injectable } from '@angular/core';

const STORAGE_KEY = 'prodeus.pendingInvite';
/** Solo letras y números: el valor termina en una ruta, no puede traer otra cosa. */
const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

/**
 * Links de invitación a grupos. Guarda el código mientras la persona pasa por
 * el login, para volver a la invitación al terminar.
 */
@Injectable({ providedIn: 'root' })
export class PendingInviteService {
  normalize(code: string): string | null {
    const value = code.trim().toUpperCase();
    return CODE_PATTERN.test(value) ? value : null;
  }

  buildLink(code: string): string {
    return `${window.location.origin}/unirse/${code}`;
  }

  save(code: string): void {
    const value = this.normalize(code);
    if (!value) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Sin storage: después del login hay que volver a abrir el link
    }
  }

  get(): string | null {
    try {
      return this.normalize(sessionStorage.getItem(STORAGE_KEY) ?? '');
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin storage no hay nada que borrar
    }
  }
}

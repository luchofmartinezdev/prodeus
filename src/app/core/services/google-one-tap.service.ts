import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** Subconjunto de Google Identity Services que usa la app. */
interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select?: boolean;
    itp_support?: boolean;
    context?: 'signin' | 'signup' | 'use';
  }): void;
  prompt(): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

/**
 * Aviso "Continuar como…" de Google. Es un atajo: Google decide si lo muestra,
 * así que la pantalla de login siempre conserva su propio botón.
 */
@Injectable({ providedIn: 'root' })
export class GoogleOneTapService {
  private script: Promise<void> | null = null;
  private isWanted = false;

  async show(onCredential: (idToken: string) => void): Promise<void> {
    const clientId = environment.googleClientId;
    if (!clientId) return;

    this.isWanted = true;
    try {
      await this.loadScript();
    } catch {
      return; // Script bloqueado o sin conexión: queda el botón
    }
    // La pantalla pudo cerrarse mientras cargaba el script
    const api = window.google?.accounts.id;
    if (!this.isWanted || !api) return;

    api.initialize({
      client_id: clientId,
      callback: ({ credential }) => onCredential(credential),
      auto_select: false,
      itp_support: true,
      context: 'signin',
    });
    api.prompt();
  }

  cancel(): void {
    this.isWanted = false;
    window.google?.accounts.id.cancel();
  }

  private loadScript(): Promise<void> {
    this.script ??= new Promise<void>((resolve, reject) => {
      const element = document.createElement('script');
      element.src = SCRIPT_SRC;
      element.async = true;
      element.onload = () => resolve();
      element.onerror = () => {
        element.remove();
        this.script = null;
        reject(new Error('No se pudo cargar Google Identity Services'));
      };
      document.head.appendChild(element);
    });
    return this.script;
  }
}

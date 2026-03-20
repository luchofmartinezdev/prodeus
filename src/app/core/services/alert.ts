import { Injectable, signal } from '@angular/core';

export interface AlertOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  alertState = signal<AlertOptions | null>(null);
  private resolveFn?: (confirmed: boolean) => void;

  /**
   * Muestra un modal de alerta y retorna una promesa que resuelve con boolean
   */
  showAlert(options: AlertOptions): Promise<boolean> {
    this.alertState.set({ 
      ...options, 
      showCancel: options.showCancel ?? false,
      confirmText: options.confirmText || 'Entendido',
      cancelText: options.cancelText || 'Cancelar',
      type: options.type || 'info'
    });

    return new Promise<boolean>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  async confirm(title: string, message: string, type: 'warning' | 'info' = 'warning'): Promise<boolean> {
    return this.showAlert({
      title,
      message,
      type,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar'
    });
  }

  success(title: string, message: string) {
    return this.showAlert({ title, message, type: 'success' });
  }

  error(title: string, message: string) {
    return this.showAlert({ title, message, type: 'error' });
  }

  info(title: string, message: string) {
    return this.showAlert({ title, message, type: 'info' });
  }

  close(result: boolean) {
    this.alertState.set(null);
    if (this.resolveFn) {
      this.resolveFn(result);
      this.resolveFn = undefined; // Limpiar para evitar doble disparo
    }
  }
}

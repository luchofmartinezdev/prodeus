import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" (click)="cancelled.emit()"></div>

      <!-- Dialog -->
      <div
        class="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <h2 class="t-display text-white text-3xl mb-2">{{ title() }}</h2>
        <p class="text-gray-300 text-sm mb-6">{{ message() }}</p>

        <div class="flex gap-3 justify-end">
          <button
            type="button"
            (click)="cancelled.emit()"
            class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="confirmed.emit()"
            class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            [class]="
              variant() === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500'
            "
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmModalComponent {
  readonly title = input<string>('¿Estás seguro?');
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirmar');
  /** 'danger' (default, rojo) para acciones destructivas; 'primary' (azul) para el resto. */
  readonly variant = input<'danger' | 'primary'>('danger');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}

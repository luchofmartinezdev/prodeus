// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Convertimos el signal a observable para el Guard
  return toObservable(authService.user).pipe(
    filter(user => user !== undefined), // Esperamos a que Firebase responda
    map(user => {
      if (!user) {
        router.navigate(['/login']);
        return false;
      }
      return true;
    }),
    take(1)
  );
};
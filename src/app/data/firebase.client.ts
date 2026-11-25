import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { environment } from '../../environments/environment';

const app = initializeApp(environment.firebase);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const functions = getFunctions(app);

// Cache local persistente (equivalente aproximado a lo que Supabase resolvía
// server-side): reduce lecturas repetidas y permite que la UI muestre datos
// mientras se reconecta. `persistentMultipleTabManager` (en vez de single-tab)
// evita que se pierda el acceso exclusivo al IndexedDB cuando el usuario tiene
// más de una pestaña de la app abierta — con single-tab, la segunda pestaña
// no podía usar el cache y caía a memoria, agregando latencia real en cada
// carga (se vio como el warning "Failed to obtain exclusive access...").
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Ya inicializado (HMR) o IndexedDB no disponible (SSR/tests) — fallback.
    return getFirestore(app);
  }
})();

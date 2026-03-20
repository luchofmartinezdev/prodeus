import { Injectable, signal, inject } from '@angular/core';
import { auth, db } from '../firebase/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  user = signal<any | null>(undefined);

  constructor() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(docRef);
          if (userDoc.exists()) {
            this.user.set({ ...firebaseUser, ...userDoc.data() });
          } else {
            console.warn(`Aviso: No se encontró un documento en Firestore para el UID: ${firebaseUser.uid}. Asegúrate de que existe en la colección 'users'.`);
            this.user.set(firebaseUser);
          }
        } catch (error: any) {
          console.error("Error crítico al obtener perfil de Firestore:", error.code, error.message);
          this.user.set(firebaseUser);
        }
      } else {
        this.user.set(null);
      }
    });
  }

  async login(email: string, pass: string) {
    // Solo autenticamos. El error se lanza para que el componente lo capture.
    return await signInWithEmailAndPassword(auth, email, pass);
  }

  async logout() {
    await signOut(auth);
    this.router.navigate(['/login']);
  }
}
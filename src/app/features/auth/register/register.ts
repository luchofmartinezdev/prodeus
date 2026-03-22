// src/app/features/auth/register/register.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { auth, db } from '../../../core/firebase/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { CompanyService } from '../../../core/services/company';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html'
})
export class RegisterComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private companyService = inject(CompanyService);

  constructor() {
    // Leemos el modo desde la URL si viene (ej: ?mode=company)
    const mode = this.route.snapshot.queryParamMap.get('mode');
    if (mode === 'company' || mode === 'user') {
      this.registerMode.set(mode);
    }
  }

  // Modo de registro: 'user' o 'company'
  registerMode = signal<'user' | 'company'>('user');

  // Estado del formulario
  name = '';
  email = '';
  password = '';
  companyName = ''; // Nombre de la empresa si es registro de empresa
  whatsapp = '';    // WhatsApp de la empresa
  companyCode = ''; // Código para unirse a una empresa existente

  loading = signal(false);
  errorMessage = signal('');

  setMode(mode: 'user' | 'company') {
    this.registerMode.set(mode);
    this.errorMessage.set('');
  }

  async onRegister() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      // 0. Validaciones previas según el modo
      let companyIdToAssign = 'pending';
      let userRole: 'user' | 'admin' = 'user';

      if (this.registerMode() === 'company') {
        if (!this.companyName.trim()) {
          this.errorMessage.set('Ingresa el nombre de tu empresa.');
          this.loading.set(false);
          return;
        }

        const existingComp = await this.companyService.getCompanyByName(this.companyName);
        if (existingComp) {
          this.errorMessage.set('🏢 Esta empresa ya existe. Si eres empleado de la misma, elige la opción "Soy Miembro" e ingresa el código de activación.');
          this.loading.set(false);
          return;
        }
        userRole = 'admin';
      } else {
        // Modo Empleado: Si pone un código, lo validamos ahora
        if (this.companyCode.trim()) {
          const comp = await this.companyService.getCompanyByJoinCode(this.companyCode);
          if (comp) {
            companyIdToAssign = comp.id;
          } else {
            this.errorMessage.set('❌ El código de activación ingresado no es válido. Pide el código a tu administrador.');
            this.loading.set(false);
            return;
          }
        }
      }

      // 1. Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, this.email, this.password);
      const user = userCredential.user;

      // 2. Actualizar perfil básico (nombre para display)
      await updateProfile(user, { displayName: this.name });

      // 3. Si es modo empresa, crear la empresa primero
      if (this.registerMode() === 'company') {
        const { companyId } = await this.companyService.registerCompany({
          name: this.companyName,
          phone: this.whatsapp,
          adminEmail: this.email,
          active: false,
          status: 'pending'
        }, user.uid);
        companyIdToAssign = companyId;
      }

      // 4. Guardar datos extendidos en Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: this.name,
        email: this.email,
        companyId: companyIdToAssign,
        role: userRole,
        totalPoints: 0,
        active: true,
        createdAt: new Date()
      });

      // Independientemente del modo, vamos al Dashboard
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage.set(this.handleError(error.code));
    } finally {
      this.loading.set(false);
    }
  }

  private handleError(code: string): string {
    console.error("Firebase Auth Error Code:", code);
    switch (code) {
      case 'auth/email-already-in-use': return 'El correo ya está registrado.';
      case 'auth/weak-password': return 'La contraseña es muy corta (mínimo 6 caracteres).';
      case 'auth/invalid-email': return 'El formato del correo electrónico no es válido.';
      case 'auth/operation-not-allowed': return 'El registro con email/password no está habilitado en Firebase Console.';
      default: return `Error: ${code}. Revisa la consola para más detalles.`;
    }
  }
}
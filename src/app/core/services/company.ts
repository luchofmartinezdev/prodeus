import { Injectable, inject } from '@angular/core';
import { db } from '../firebase/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  Timestamp,
  arrayUnion,
  where,
  query,
  getDocs 
} from 'firebase/firestore';
import { Company } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {

  /**
   * Registra una nueva empresa activada por defecto.
   */
  async registerCompany(companyData: Partial<Company>, adminUserId: string) {
    const companyId = companyData.id || doc(collection(db, 'companies')).id;
    // Generar un código simple para unirse: NOMBRE-AÑO
    const safeName = (companyData.name || 'COMPANY').toUpperCase().replace(/\s/g, '');
    const joinCode = `${safeName}-${new Date().getFullYear()}`;

    const newCompany: Company = {
      id: companyId,
      name: companyData.name || '',
      adminUserId: adminUserId,
      adminEmail: companyData.adminEmail,
      phone: companyData.phone || '',
      active: true,
      joinCode: joinCode,
      createdAt: Timestamp.now(),
      ...companyData
    };

    await setDoc(doc(db, 'companies', companyId), newCompany);
    
    return { companyId, joinCode };
  }

  /**
   * Actualiza el torneo activo para una empresa
   */
  async updateCompanyTournament(companyId: string, tournamentId: string) {
    const compRef = doc(db, 'companies', companyId);
    await updateDoc(compRef, { 
      activeTournamentId: tournamentId,
      subscribedTournaments: arrayUnion(tournamentId)
    });
  }

  

  async getCompany(id: string): Promise<Company | null> {
    const snap = await getDoc(doc(db, 'companies', id));
    return snap.exists() ? (snap.data() as Company) : null;
  }

  async getCompanyByJoinCode(code: string): Promise<Company | null> {
    const q = query(collection(db, 'companies'), where('joinCode', '==', code.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Company;
  }

  async getCompanyByName(name: string): Promise<Company | null> {
    const q = query(collection(db, 'companies'), where('name', '==', name.trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Company;
  }
}

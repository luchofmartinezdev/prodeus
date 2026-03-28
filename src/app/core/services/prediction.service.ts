import { inject, Injectable } from '@angular/core';
import type { Prediction } from '../../data/database.types';
import {
  PredictionRepository,
  type PredictionDto,
} from '../../data/repositories/prediction.repository';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private readonly repo = inject(PredictionRepository);

  async getByGroup(groupId: string, userId: string): Promise<Prediction[]> {
    const { data, error } = await this.repo.findByGroup(groupId, userId);
    if (error) throw new Error('No se pudieron cargar las predicciones');
    return data ?? [];
  }

  async save(dto: PredictionDto, deadline: string): Promise<Prediction> {
    if (new Date() >= new Date(deadline)) {
      throw new Error('El deadline para este partido ya pasó');
    }
    const { data, error } = await this.repo.upsert(dto);
    if (error) throw new Error('No se pudo guardar la predicción');
    return data as unknown as Prediction;
  }
}

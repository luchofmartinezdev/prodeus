import { Component, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService } from '../../../core/services/tournament';

@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-card.html'
})
export class MatchCardComponent {
  homeId = input.required<string>();
  awayId = input.required<string>();
  group = input<string>();
  matchDate = input<any>();
  stadium = input<string>();
  hasActionContent = input(false);
  
  homePlaceholder = input<string | undefined>();
  awayPlaceholder = input<string | undefined>();

  private tournamentService = inject(TournamentService);

  public homeData = computed(() => {
    const id = this.homeId();
    if (id) return this.tournamentService.getCountry(id);
    const ph = this.homePlaceholder();
    if (ph) return { id: ph, name: 'A Confirmar (' + ph + ')', flagUrl: 'https://flagcdn.com/unknown.svg' } as any;
    return null;
  });

  public awayData = computed(() => {
    const id = this.awayId();
    if (id) return this.tournamentService.getCountry(id);
    const ph = this.awayPlaceholder();
    if (ph) return { id: ph, name: 'A Confirmar (' + ph + ')', flagUrl: 'https://flagcdn.com/unknown.svg' } as any;
    return null;
  });


  public formattedDate = computed(() => {
    const d = this.matchDate();
    if (!d) return null;
    // Si viene de Firebase como Timestamp, convertirlo a Date
    if (typeof d === 'object' && 'toDate' in d) {
      return (d as any).toDate();
    }
    return d;
  });
}
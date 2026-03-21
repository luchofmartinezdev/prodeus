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


  private tournamentService = inject(TournamentService);

  public homeData = computed(() => this.tournamentService.getCountry(this.homeId()));
  public awayData = computed(() => this.tournamentService.getCountry(this.awayId()));

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
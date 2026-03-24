import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth';
import { CommonModule } from '@angular/common';

import { BadgeComponent } from '../../shared/components/badge/badge';
import { StatsCardComponent } from '../../shared/components/stats-card/stats-card';
import { ImmersiveBannerComponent } from '../../shared/components/immersive-banner/immersive-banner';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, BadgeComponent, StatsCardComponent, ImmersiveBannerComponent],
  templateUrl: './profile.html'
})
export class ProfileComponent { auth = inject(AuthService); }
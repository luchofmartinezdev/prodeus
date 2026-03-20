import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../services/alert';

@Component({
  selector: 'app-alert-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-modal.html'
})
export class AlertModalComponent {
  public alertService = inject(AlertService);

  get state() {
    return this.alertService.alertState();
  }

  confirm() {
    this.alertService.close(true);
  }

  cancel() {
    this.alertService.close(false);
  }
}

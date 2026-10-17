import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Status } from './platform/status';

@Component({
  imports: [MatButtonModule], selector: 'app-root',
  styleUrl: './app.css', templateUrl: './app.html',
})
export class App {
  private readonly status = inject(Status);
  protected readonly connection = signal('Unchecked');
  protected readonly checking = signal(false);
  protected checkConnection() {
    this.checking.set(true);
    this.status.check().subscribe({
      next: response => { this.connection.set(response.status === 'ready' ? 'Connected' : 'Unavailable'); this.checking.set(false); },
      error: () => { this.connection.set('Unavailable — check the local backend'); this.checking.set(false); },
    });
  }
}

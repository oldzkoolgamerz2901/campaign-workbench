import {
  Component,
  Type,
  inject,
  isDevMode,
  signal,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { loadPreparationPrototype } from './preparation/prototype-loader';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Status } from './platform/status';

@Component({
  imports: [MatButtonModule, RouterOutlet, NgComponentOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // Authorized disposable design experiment, isolated from the normal library and API state.
  protected readonly showingPrototype =
    isDevMode() && new URLSearchParams(window.location.search).get('prototype') === 'preparation';
  protected readonly prototypeType = signal<Type<unknown> | null>(null);
  constructor() {
    if (this.showingPrototype) {
      void loadPreparationPrototype().then((component) => this.prototypeType.set(component));
    } else this.checkConnection();
  }
  private readonly destroyRef = inject(DestroyRef);
  @HostListener('window:focus') foreground() {
    if (!this.showingPrototype) this.checkConnection();
  }
  private readonly status = inject(Status);
  protected readonly connection = signal('Unchecked');
  protected readonly checking = signal(false);
  protected checkConnection() {
    if (this.checking()) return;
    this.checking.set(true);
    this.status
      .check()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.connection.set(response.status === 'ready' ? 'Connected' : 'Unavailable');
          this.checking.set(false);
        },
        error: () => {
          this.connection.set('Unavailable — check the local backend');
          this.checking.set(false);
        },
      });
  }
}

import { Injectable, inject } from '@angular/core';
import { StatusControllerService } from '../../api/generated';

@Injectable({ providedIn: 'root' })
export class Status {
  private readonly api = inject(StatusControllerService);
  check() { return this.api.getStatus(); }
}

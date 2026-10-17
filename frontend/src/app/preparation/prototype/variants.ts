import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { PrototypeState } from './prototype-state';

@Component({ selector: 'preparation-variant-a', imports: [FormsModule, MatButtonModule], templateUrl: './variant-a.html', styleUrls: ['./prototype-shared.css', './variant-a.css'] })
export class VariantA { readonly s = inject(PrototypeState); }
@Component({ selector: 'preparation-variant-b', imports: [FormsModule, MatButtonModule], templateUrl: './variant-b.html', styleUrls: ['./prototype-shared.css', './variant-b.css'] })
export class VariantB { readonly s = inject(PrototypeState); }
@Component({ selector: 'preparation-variant-c', imports: [FormsModule, MatButtonModule], templateUrl: './variant-c.html', styleUrls: ['./prototype-shared.css', './variant-c.css'] })
export class VariantC { readonly s = inject(PrototypeState); }

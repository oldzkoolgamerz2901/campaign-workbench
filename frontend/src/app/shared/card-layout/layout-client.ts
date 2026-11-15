import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { CardLayout } from '../../../api/generated/model/cardLayout';
import type { CardLayoutInput } from '../../../api/generated/model/cardLayoutInput';

export interface CardLayoutClient {
  calculate(content: CardLayoutInput, context: string): Observable<CardLayout>;
}
export const CARD_LAYOUT_CLIENT = new InjectionToken<CardLayoutClient>('CardLayoutClient');

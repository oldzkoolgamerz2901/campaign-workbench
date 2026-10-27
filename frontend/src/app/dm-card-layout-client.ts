import { inject, Provider } from '@angular/core';
import { CardLayoutControllerService } from '../api/generated/api/cardLayoutController.service';
import { CARD_LAYOUT_CLIENT, CardLayoutClient } from './shared/card-layout/layout-client';

/** DM application transport; the shared presentation only depends on its client port. */
export const DM_CARD_LAYOUT_CLIENT: Provider = {
  provide: CARD_LAYOUT_CLIENT,
  useFactory: (): CardLayoutClient => {
    const api = inject(CardLayoutControllerService);
    return { calculate: (content) => api.calculateCardLayout(content) };
  },
};

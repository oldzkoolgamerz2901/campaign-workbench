import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../api/generated';
import { routes } from './app.routes';
import { DM_CARD_LAYOUT_CLIENT } from './dm-card-layout-client';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(), provideRouter(routes), DM_CARD_LAYOUT_CLIENT,
    { provide: BASE_PATH, useValue: '' }]
};

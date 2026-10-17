import { inject } from '@angular/core';
import { Routes, CanActivateFn } from '@angular/router';
import { Workspace } from './preparation/workspace';
import { SessionState } from './preparation/session-state';
const protectWorkingSession: CanActivateFn = (route) => {
  const state = inject(SessionState),
    current = state.current();
  if (
    !current ||
    (route.queryParamMap.get('session') === current.id &&
      route.queryParamMap.get('campaign') === current.campaign)
  )
    return true;
  return state.allowLeave();
};
export const routes: Routes = [
  {
    path: '',
    component: Workspace,
    canActivate: [protectWorkingSession],
    runGuardsAndResolvers: 'always',
  },
];

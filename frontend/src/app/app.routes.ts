import { inject } from '@angular/core';
import { Routes, CanActivateFn } from '@angular/router';
import { Workspace } from './preparation/workspace';
import { SessionState } from './preparation/session-state';
import { WritingState } from './writing/writing-state';
import { RecoveryState } from './writing/recovery-state';
const protectWorkingSession: CanActivateFn = (route) => {
  const state = inject(SessionState),
    current = state.current();
  if (state.queueRunning()) return state.allowLeave();
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
    path: 'writing/recovery',
    loadComponent: () => import('./writing/recovery-workspace').then((m) => m.RecoveryWorkspace),
    canActivate: [
      () => {
        const sessions = inject(SessionState),
          writing = inject(WritingState);
        return sessions.allowLeave().then((ok) => ok && writing.allowLeave());
      },
    ],
    canDeactivate: [() => !inject(RecoveryState).busy()],
  },
  {
    path: 'writing',
    loadComponent: () => import('./writing/writing-workspace').then((m) => m.WritingWorkspace),
    canActivate: [
      () => {
        const sessions = inject(SessionState),
          writing = inject(WritingState);
        return sessions.allowLeave().then((ok) => ok && writing.allowLeave());
      },
    ],
    canDeactivate: [() => inject(WritingState).allowLeave()],
    runGuardsAndResolvers: 'always',
  },
  {
    path: '',
    component: Workspace,
    canActivate: [protectWorkingSession],
    runGuardsAndResolvers: 'always',
  },
];

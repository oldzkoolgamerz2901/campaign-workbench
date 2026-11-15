import { inject } from '@angular/core';
import { Routes, CanActivateFn } from '@angular/router';
import { Workspace } from './preparation/workspace';
import { SessionState } from './preparation/session-state';
import { WritingState } from './writing/writing-state';
import { RecoveryState } from './writing/recovery-state';
const protectWorkingSession: CanActivateFn = (route) => {
  const state = inject(SessionState),
    current = state.current();
  if (
    current &&
    route.queryParamMap.get('session') === current.id &&
    route.queryParamMap.get('campaign') === current.campaign
  )
    return true;
  // Preparation reload temporarily clears current while retaining independent table edits.
  return state.allowLeave();
};
export const routes: Routes = [
  { path: 'share', loadComponent: () => import('./sharing/share-workspace').then(m => m.ShareWorkspace),
    canActivate: [() => { const sessions=inject(SessionState),writing=inject(WritingState);return sessions.allowLeave().then(ok=>ok&&writing.allowLeave()); }], runGuardsAndResolvers:'always' },
  {
    path: 'library',
    loadComponent: () => import('./campaigns/unified-library').then((m) => m.UnifiedLibrary),
    canActivate: [
      () => {
        const sessions = inject(SessionState),
          writing = inject(WritingState);
        return sessions.allowLeave().then((ok) => ok && writing.allowLeave());
      },
    ],
    runGuardsAndResolvers: 'always',
  },
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

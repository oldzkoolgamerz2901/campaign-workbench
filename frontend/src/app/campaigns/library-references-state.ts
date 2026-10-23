import { InjectionToken } from '@angular/core';
import { UnifiedLibraryState } from './unified-library-state';
/** Reuse the unified catalogue logic with an independent contextual selection. */
export const REFERENCE_LIBRARY_STATE = new InjectionToken<UnifiedLibraryState>(
  'Contextual Library collection',
  {
    providedIn: 'root',
    factory: () => new UnifiedLibraryState(),
  },
);

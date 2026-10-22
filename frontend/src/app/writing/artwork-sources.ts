import { Injectable, inject } from '@angular/core';
import { ArtworkControllerService, DraftData } from '../../api/generated';
import { ArtworkSource } from '../shared/artwork/artwork-image';

@Injectable({ providedIn: 'root' })
export class WritingArtwork {
  private readonly api = inject(ArtworkControllerService);
  draft(draft: DraftData, variant: 'DISPLAY' | 'THUMBNAIL' = 'DISPLAY'): ArtworkSource | null {
    return draft.image
      ? {
          key: `draft:${draft.campaign}:${draft.id}:${draft.image.hash}:${variant}`,
          load: () => this.api.getDraftArtwork(draft.campaign, draft.id, variant),
        }
      : null;
  }
  recovered(workspace: string, key: string, draft: DraftData): ArtworkSource | null {
    return draft.image
      ? {
          key: `recovery:${workspace}:${key}:${draft.image.hash}`,
          load: () => this.api.getRecoveredArtwork(workspace, key, 'DISPLAY'),
        }
      : null;
  }
}

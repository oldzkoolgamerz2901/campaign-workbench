import { Injectable, inject } from '@angular/core';
import { PreparedArtworkControllerService, PreparedItemData } from '../../api/generated';
import { ArtworkSource } from '../shared/artwork/artwork-image';

@Injectable({ providedIn: 'root' })
export class PreparedArtwork {
  private readonly api = inject(PreparedArtworkControllerService);
  item(
    campaign: string,
    session: string,
    item: PreparedItemData,
    variant: 'DISPLAY' | 'THUMBNAIL' = 'DISPLAY',
  ): ArtworkSource | null {
    return item.image && campaign && session
      ? {
          key: `prepared:${campaign}:${session}:${item.id}:${item.image.hash}:${variant}`,
          load: () => this.api.getPreparedArtwork(campaign, session, item.id, variant),
        }
      : null;
  }
}

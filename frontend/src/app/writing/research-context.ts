import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ResearchContext {
  readonly away = signal(false);
  readonly editorTab = signal<'document' | 'card'>('document');
  readonly support = signal<'preview' | 'library'>('preview');
  readonly panelOpen = signal(true);
  readonly fullPreview = signal(false);
  readonly returnTo = signal<{
    campaign: string;
    session: string | null;
    draft: string;
    cursor: number;
    editorScroll: number;
    pageScroll: number;
  } | null>(null);
}

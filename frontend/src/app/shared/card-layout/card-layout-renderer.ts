import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CARD_FONTS, CardLayout } from './card-layout';

export type LayoutStatus =
  | 'checking'
  | 'ready'
  | 'non-fitting'
  | 'font-unavailable'
  | 'profile-mismatch'
  | 'overflow';

let fontLoad: Promise<void> | undefined;
function loadCardFonts(): Promise<void> {
  return (fontLoad ??= (async () => {
    for (const value of Object.values(CARD_FONTS)) {
      const response = await fetch(value.file);
      if (!response.ok) throw new Error('Font unavailable');
      const bytes = await response.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (hash !== value.hash) throw new Error('Font identity differs');
      const font = await new FontFace(value.family, bytes).load();
      document.fonts.add(font);
    }
  })().catch((error) => {
    fontLoad = undefined;
    throw error;
  }));
}

/** Text/geometry layer only. The integrating card owns artwork, controls and external reading. */
@Component({
  selector: 'card-layout-renderer',
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
      role="img"
      [attr.aria-label]="label()"
      [attr.aria-hidden]="status() !== 'ready'"
      [style.visibility]="status() === 'ready' ? 'visible' : 'hidden'"
    >
      <desc>{{ description() }}</desc>
      @for (box of current().boxes; track $index) {
        @if (box.role === 'front-panel' || box.role === 'tag') {
          <rect
            [attr.x]="box.x"
            [attr.y]="box.y"
            [attr.width]="box.width"
            [attr.height]="box.height"
            [attr.rx]="box.role === 'tag' ? 8 : 5"
            [attr.data-role]="box.role"
          />
        }
      }
      @for (line of current().lines; track $index) {
        <text
          [attr.x]="line.x"
          [attr.y]="line.baseline"
          [attr.font-family]="family(line.font)"
          [attr.font-size]="line.size"
          [attr.data-field]="line.field"
          [textContent]="line.text"
        ></text>
      }
    </svg>
    @if (showStatus() && status() !== 'ready') {
      <p role="status">
        {{
          status() === 'checking' ? 'Checking card layout…' : 'Card layout unavailable: ' + status()
        }}
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: 243 / 420;
      color: #28352b;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    text {
      white-space: pre;
      fill: currentColor;
      font-weight: 400;
      font-style: normal;
      font-synthesis: none;
      font-kerning: none;
      font-variant-ligatures: none;
      letter-spacing: 0;
      word-spacing: 0;
    }
    rect {
      fill: #f2efdc;
      stroke: #a49d80;
      stroke-width: 0.75;
    }
    p {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 1rem;
      overflow-wrap: anywhere;
    }
  `,
})
export class CardLayoutRenderer {
  readonly layout = input.required<CardLayout>();
  readonly side = input<'front' | 'back'>('front');
  readonly label = input('Card text');
  readonly showStatus = input(true);
  readonly checked = output<LayoutStatus>();
  readonly status = signal<LayoutStatus>('checking');
  readonly current = computed(() => this.layout()[this.side()]);
  readonly description = computed(() =>
    this.current()
      .lines.map((line) => line.text)
      .join('\n'),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  family(key: string) {
    return CARD_FONTS[key]?.family ?? '';
  }

  constructor() {
    effect((cleanup) => {
      const layout = this.layout(),
        side = this.current();
      let cancelled = false;
      cleanup(() => {
        cancelled = true;
      });
      const finish = (status: LayoutStatus) => {
        if (!cancelled) {
          this.status.set(status);
          this.checked.emit(status);
        }
      };
      this.status.set('checking');
      if (
        layout.profile !== 'physical-card-1' ||
        layout.width !== 243 ||
        layout.height !== 420 ||
        Object.entries(CARD_FONTS).some(([key, value]) => layout.fonts[key] !== value.hash)
      ) {
        finish('profile-mismatch');
        return;
      }
      if (!side.fits) {
        finish('non-fitting');
        return;
      }
      void loadCardFonts()
        .then(() => {
          if (cancelled) return;
          // Wait for Angular's DOM update; check in canonical SVG units, independent of viewport scale.
          requestAnimationFrame(() => {
            if (cancelled) return;
            const texts = this.host.nativeElement.querySelectorAll<SVGTextElement>('text');
            const overflow =
              texts.length !== side.lines.length ||
              [...texts].some((text, i) => {
                const line = side.lines[i],
                  box = text.getBBox();
                if (!line.text) return text.textContent !== '';
                return (
                  box.x < -0.25 ||
                  box.y < -0.25 ||
                  box.x + box.width > layout.width + 0.25 ||
                  box.y + box.height > layout.height + 0.25 ||
                  Math.abs(text.getComputedTextLength() - line.width) > 0.75 ||
                  box.y < line.baseline - line.ascent - 0.75 ||
                  box.y + box.height > line.baseline + line.descent + 0.75
                );
              });
            finish(overflow ? 'overflow' : 'ready');
          });
        })
        .catch(() => finish('font-unavailable'));
    });
  }
}

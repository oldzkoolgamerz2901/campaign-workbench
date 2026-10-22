import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LibraryState } from '../campaigns/library-state';
import { PreparedArtwork } from './artwork-sources';
import { SessionState } from './session-state';
import { Workspace } from './workspace';

describe('Preparation recovery in the current workspace', () => {
  const session = { id: 'session-a', campaign: 'campaign-a' };
  let component: Workspace;
  let state: {
    current: ReturnType<typeof signal<typeof session | null>>;
    flush: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
    initializeTable: ReturnType<typeof vi.fn>;
    play: {
      hasUnsaved: ReturnType<typeof vi.fn>;
      expandedItemId: ReturnType<typeof signal<string | null>>;
    };
  };
  beforeEach(() => {
    state = {
      current: signal<typeof session | null>(session),
      flush: vi.fn().mockResolvedValue(true),
      reload: vi.fn().mockResolvedValue(true),
      initializeTable: vi.fn().mockResolvedValue(undefined),
      play: {
        hasUnsaved: vi.fn().mockReturnValue(false),
        expandedItemId: signal<string | null>(null),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionState, useValue: state },
        // Route initialization is deliberately pending while recovery is exercised.
        { provide: LibraryState, useValue: { initialize: () => new Promise(() => {}) } },
        { provide: PreparedArtwork, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).overrideComponent(Workspace, { set: { template: '', imports: [] } });
    component = TestBed.createComponent(Workspace).componentInstance;
    component.reading.set(true);
  });

  it.each(['retry', 'reload'] as const)(
    'resumes Play after successful Preparation %s',
    async (action) => {
      await component.recoverPreparation(action);
      expect(state.initializeTable).toHaveBeenCalledTimes(1);
    },
  );

  it('does not open Play in Prepare or retry failed workspace edits through Preparation recovery', async () => {
    component.reading.set(false);
    await component.recoverPreparation('reload');
    component.reading.set(true);
    state.play.hasUnsaved.mockReturnValue(true);
    await component.recoverPreparation('retry');
    expect(state.initializeTable).not.toHaveBeenCalled();
  });

  it.each(['retry', 'reload'] as const)(
    'ignores a late %s after campaign/session navigation',
    async (action) => {
      let finish!: (ok: boolean) => void;
      state[action === 'retry' ? 'flush' : 'reload'].mockReturnValue(
        new Promise<boolean>((resolve) => (finish = resolve)),
      );
      const recovery = component.recoverPreparation(action);
      state.current.set({ campaign: 'campaign-b', id: 'session-b' });
      finish(true);
      await recovery;
      expect(state.initializeTable).not.toHaveBeenCalled();
    },
  );

  it('does not reopen Play after recovery is cancelled, fails, or completes after leaving the component', async () => {
    state.reload.mockResolvedValue(false);
    await component.recoverPreparation('reload');
    let finish!: (ok: boolean) => void;
    state.flush.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    const recovery = component.recoverPreparation('retry');
    component.ngOnDestroy();
    finish(true);
    await recovery;
    expect(state.initializeTable).not.toHaveBeenCalled();
  });

  it('does not initialize an unopened workspace when recovery completes after returning to Prepare', async () => {
    let finish!: (ok: boolean) => void;
    state.flush.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    const recovery = component.recoverPreparation('retry');
    component.reading.set(false);
    finish(true);
    await recovery;
    expect(state.initializeTable).not.toHaveBeenCalled();
  });
});

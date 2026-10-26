import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { PlaythroughControllerService, WorkspaceData } from '../../api/generated';
import { PlayWorkspaceState } from './workspace-state';
const workspace = (session = 'session-a'): WorkspaceData => ({
  session,
  revision: 4,
  sessionCards: ['a', 'b', 'c'],
  used: [],
  activeSceneItemId: null,
  pile1: { name: null, items: [], cover: null },
  pile2: { name: null, items: [], cover: null },
});
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('Play command lifecycle', () => {
  let state: PlayWorkspaceState;
  const api = {
    openPlayWorkspace: vi.fn(),
    movePlayCard: vi.fn(),
    reorderPlayCards: vi.fn(),
    choosePlayCover: vi.fn(),
    renamePlayPile: vi.fn(),
    transitionPlayScene: vi.fn(),
    playSceneOverview: vi.fn(),
  };
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.openPlayWorkspace.mockReturnValue(of(workspace()));
    TestBed.configureTestingModule({
      providers: [{ provide: PlaythroughControllerService, useValue: api }],
    });
    state = TestBed.inject(PlayWorkspaceState);
  });
  afterEach(() => vi.restoreAllMocks());
  it('serializes commands with the last acknowledged revision without inventing a second placement authority', async () => {
    await state.open('campaign-a', 'session-a');
    const first = new Subject<WorkspaceData>(),
      second = new Subject<WorkspaceData>();
    api.movePlayCard.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const move = state.move('a', 'PILE_1');
    const used = state.move('b', 'USED');
    await tick();
    expect(api.movePlayCard).toHaveBeenCalledTimes(1);
    expect(state.current()).toEqual(workspace());
    first.next({
      ...workspace(),
      revision: 5,
      sessionCards: ['b', 'c'],
      pile1: { name: null, items: ['a'], cover: 'a' },
    });
    await tick();
    expect(api.movePlayCard.mock.calls[1][2]).toEqual({
      revision: 5,
      item: 'b',
      destination: 'USED',
      index: undefined,
    });
    second.next({
      ...workspace(),
      revision: 6,
      sessionCards: ['c'],
      used: ['b'],
      pile1: { name: null, items: ['a'], cover: 'a' },
    });
    expect(await move).toBe(true);
    expect(await used).toBe(true);
    expect(state.hasUnsaved()).toBe(false);
  });
  it.each([409, 503, 0])(
    'retains failed intent and does not replay during flush/navigation after %s',
    async (status) => {
      await state.open('campaign-a', 'session-a');
      api.movePlayCard.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status, error: { detail: 'Changed elsewhere' } })),
      );
      expect(await state.move('a', 'USED')).toBe(false);
      expect(state.current()).toEqual(workspace());
      expect(state.retainedAction()).toContain('used');
      expect(await state.flush()).toBe(false);
      expect(await state.move('b', 'PILE_1')).toBe(false);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      expect(await state.allowLeave()).toBe(false);
      expect(api.movePlayCard).toHaveBeenCalledTimes(1);
    },
  );
  it('checks server revision before explicitly retrying and never replays an uncertain completed action', async () => {
    await state.open('campaign-a', 'session-a');
    api.movePlayCard.mockReturnValue(throwError(() => new Error('network')));
    await state.move('a', 'USED');
    api.openPlayWorkspace.mockReturnValue(
      of({ ...workspace(), revision: 5, sessionCards: ['b', 'c'], used: ['a'] }),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await state.retry()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(api.movePlayCard).toHaveBeenCalledTimes(1);
    expect(state.hasUnsaved()).toBe(true);
    await state.reload();
    expect(state.hasUnsaved()).toBe(false);
    expect(state.current()?.used).toEqual(['a']);
  });
  it('retries unchanged saved state only after explicit confirmation', async () => {
    await state.open('campaign-a', 'session-a');
    api.movePlayCard
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(
        of({ ...workspace(), revision: 5, used: ['a'], sessionCards: ['b', 'c'] }),
      );
    await state.move('a', 'USED');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await state.retry()).toBe(true);
    expect(api.movePlayCard.mock.calls[1][2].revision).toBe(4);
  });
  it('pins originating identities and ignores late replies without clearing the destination queue', async () => {
    await state.open('campaign-a', 'session-a');
    const old = new Subject<WorkspaceData>();
    api.movePlayCard.mockReturnValueOnce(old);
    const saving = state.move('a', 'USED');
    await tick();
    state.clear();
    api.openPlayWorkspace.mockReturnValue(of(workspace('session-b')));
    await state.open('campaign-b', 'session-b');
    const next = new Subject<WorkspaceData>();
    api.movePlayCard.mockReturnValueOnce(next);
    const pending = state.move('b', 'PILE_2');
    await tick();
    old.next({ ...workspace(), revision: 5 });
    expect(await saving).toBe(false);
    expect(state.commandBusy()).toBe(true);
    next.next({ ...workspace('session-b'), revision: 5 });
    expect(await pending).toBe(true);
    expect(api.movePlayCard.mock.calls[1].slice(0, 2)).toEqual(['campaign-b', 'session-b']);
  });
  it('ignores departed or superseded Scene overviews', async () => {
    await state.open('campaign-a', 'session-a');
    const a = new Subject<any>(),
      b = new Subject<any>();
    api.playSceneOverview.mockReturnValueOnce(a).mockReturnValueOnce(b);
    const first = state.loadOverview('a');
    await tick();
    const second = state.loadOverview('b');
    await tick();
    b.next({ workspace: workspace(), preparationRevision: 3, scene: 'b', relatedItemIds: ['c'] });
    await second;
    a.next({ workspace: workspace(), preparationRevision: 2, scene: 'a', relatedItemIds: [] });
    await first;
    expect(state.overview()?.scene).toBe('b');
    state.closeOverview();
    expect(state.overview()).toBeNull();
  });
  it('refreshes a failed Scene context explicitly, preserving the dialog for review', async () => {
    await state.open('campaign-a', 'session-a');
    api.transitionPlayScene.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await state.transition({ scene: 'a', preparationRevision: 2, movements: [] });
    api.playSceneOverview.mockReturnValue(
      of({ workspace: workspace(), preparationRevision: 3, scene: 'a', relatedItemIds: ['b'] }),
    );
    await state.refreshOverview('a');
    expect(state.overview()?.preparationRevision).toBe(3);
    expect(state.hasUnsaved()).toBe(false);
    expect(api.transitionPlayScene).toHaveBeenCalledTimes(1);
  });
  it('recovers failed opens with explicit reload', async () => {
    api.openPlayWorkspace.mockReturnValueOnce(throwError(() => new Error('offline')));
    await state.open('campaign-a', 'session-a');
    expect(state.current()).toBeNull();
    await state.reload();
    expect(state.current()).toEqual(workspace());
  });
});

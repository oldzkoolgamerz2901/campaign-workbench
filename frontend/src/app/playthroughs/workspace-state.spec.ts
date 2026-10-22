import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { PlaythroughControllerService, WorkspaceData } from '../../api/generated';
import { PlayWorkspaceState } from './workspace-state';

const workspace = (session = 'session-a'): WorkspaceData => ({
  session,
  revision: 4,
  active: ['a', 'b', 'c'],
  used: [],
  activeSceneItemId: null,
  focusedItemIds: [],
});

describe('Play workspace save lifecycle', () => {
  let state: PlayWorkspaceState;
  const api = { openPlayWorkspace: vi.fn(), savePlayWorkspace: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.openPlayWorkspace.mockReturnValue(of(workspace()));
    TestBed.configureTestingModule({
      providers: [{ provide: PlaythroughControllerService, useValue: api }],
    });
    state = TestBed.inject(PlayWorkspaceState);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('serializes slow saves and applies newer edits with the completed workspace revision', async () => {
    await state.open('campaign-a', 'session-a');
    const first = new Subject<WorkspaceData>(),
      second = new Subject<WorkspaceData>();
    api.savePlayWorkspace.mockReturnValueOnce(first).mockReturnValueOnce(second);
    state.use('b');
    const saving = state.flush();
    state.move('c', 0);
    expect(api.savePlayWorkspace).toHaveBeenCalledTimes(1);
    first.next({ ...workspace(), revision: 5, active: ['a', 'c'], used: ['b'] });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(api.savePlayWorkspace.mock.calls[1][2]).toEqual({
      revision: 5,
      active: ['c', 'a'],
      used: ['b'],
      activeSceneItemId: null,
      focusedItemIds: [],
    });
    second.next({ ...workspace(), revision: 6, active: ['c', 'a'], used: ['b'] });
    expect(await saving).toBe(true);
    expect(state.status()).toBe('saved');
    expect(state.hasUnsaved()).toBe(false);
  });

  it('retains conflict edits, stops autosave, guards departure and reloads only after explicit discard', async () => {
    await state.open('campaign-a', 'session-a');
    api.savePlayWorkspace.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Changed elsewhere' } }),
      ),
    );
    state.use('b');
    expect(await state.flush()).toBe(false);
    state.move('c', 0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.savePlayWorkspace).toHaveBeenCalledTimes(1);
    expect(state.current()?.revision).toBe(4);
    expect(state.current()?.used).toEqual(['b']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await state.allowLeave()).toBe(false);
    await state.reload();
    expect(state.current()?.used).toEqual(['b']);
    confirm.mockReturnValue(true);
    await state.reload();
    expect(state.current()).toEqual(workspace());
    expect(state.hasUnsaved()).toBe(false);
  });

  it('retries temporary failure with retained order and permits an explicit departure discard', async () => {
    await state.open('campaign-a', 'session-a');
    api.savePlayWorkspace.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    state.use('a');
    await state.flush();
    api.savePlayWorkspace.mockReturnValue(
      of({ ...workspace(), revision: 5, active: ['b', 'c'], used: ['a'] }),
    );
    expect(await state.flush()).toBe(true);
    state.restore('a');
    api.savePlayWorkspace.mockReturnValue(throwError(() => new Error('offline')));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await state.allowLeave()).toBe(true);
    expect(state.hasUnsaved()).toBe(false);
  });

  it.each([409, 503])(
    'cancels a newer queued autosave when an in-flight save fails with %s',
    async (status) => {
      await state.open('campaign-a', 'session-a');
      const response = new Subject<WorkspaceData>();
      api.savePlayWorkspace.mockReturnValueOnce(response);
      state.use('a');
      const saving = state.flush();
      state.use('b');
      response.error(new HttpErrorResponse({ status, error: { detail: 'Save failed' } }));
      expect(await saving).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(api.savePlayWorkspace).toHaveBeenCalledTimes(1);
      expect(state.current()).toEqual({ ...workspace(), active: ['c'], used: ['b', 'a'] });
      expect(state.status()).toBe('failed');
      expect(state.error()).toBe('Save failed');
      api.savePlayWorkspace.mockReturnValue(of({ ...state.current()!, revision: 5 }));
      expect(await state.flush()).toBe(true);
      expect(api.savePlayWorkspace.mock.calls[1][2]).toEqual({
        revision: 4,
        active: ['c'],
        used: ['b', 'a'],
        activeSceneItemId: null,
        focusedItemIds: [],
      });
    },
  );

  it('ignores late opens and saves and cannot clear a new identity save queue', async () => {
    const opening = new Subject<WorkspaceData>();
    api.openPlayWorkspace.mockReturnValueOnce(opening);
    const oldOpen = state.open('campaign-a', 'session-a');
    state.clear();
    api.openPlayWorkspace.mockReturnValue(of(workspace('session-b')));
    await state.open('campaign-b', 'session-b');
    opening.next(workspace());
    await oldOpen;
    expect(state.current()?.session).toBe('session-b');
    const oldSave = new Subject<WorkspaceData>(),
      newSave = new Subject<WorkspaceData>();
    api.savePlayWorkspace.mockReturnValueOnce(oldSave).mockReturnValueOnce(newSave);
    state.use('a');
    const oldSaving = state.flush();
    state.clear();
    api.openPlayWorkspace.mockReturnValue(of(workspace('session-c')));
    await state.open('campaign-c', 'session-c');
    state.use('b');
    const newSaving = state.flush();
    oldSave.next({ ...workspace('session-b'), revision: 5 });
    expect(await oldSaving).toBe(false);
    expect(state.status()).toBe('saving');
    expect(state.current()?.session).toBe('session-c');
    newSave.next({ ...workspace('session-c'), revision: 5, active: ['a', 'c'], used: ['b'] });
    expect(await newSaving).toBe(true);
    expect(api.savePlayWorkspace.mock.calls[1].slice(0, 2)).toEqual(['campaign-c', 'session-c']);
  });

  it('saves explicit scene/focus together without table actions changing them', async () => {
    await state.open('campaign-a', 'session-a');
    expect(state.current()?.activeSceneItemId).toBeNull();
    state.setFocus(['b', 'a']);
    state.activateScene('a');
    state.use('a');
    state.move('c', 0);
    expect(state.current()?.focusedItemIds).toEqual(['b', 'a']);
    expect(state.current()?.activeSceneItemId).toBe('a');
    const retained = state.current();
    state.setFocus(['a', 'a']);
    state.setFocus(['a', 'b', 'c', 'd']);
    state.setFocus(['missing']);
    state.activateScene('missing');
    expect(state.current()).toBe(retained);
    api.savePlayWorkspace.mockImplementation((_c, session, body) =>
      of({ session, ...body, revision: 5 }),
    );
    expect(await state.flush()).toBe(true);
    expect(api.savePlayWorkspace.mock.calls[0][2]).toEqual({
      revision: 4,
      active: ['c', 'b'],
      used: ['a'],
      activeSceneItemId: 'a',
      focusedItemIds: ['b', 'a'],
    });
    api.openPlayWorkspace.mockReturnValue(of(state.current()));
    await state.open('campaign-a', 'session-a');
    expect(state.current()?.focusedItemIds).toEqual(['b', 'a']);
    expect(state.current()?.activeSceneItemId).toBe('a');
    state.restore('a');
    expect(state.current()?.focusedItemIds).toEqual(['b', 'a']);
    state.activateScene(null);
    state.setFocus([]);
    expect(await state.flush()).toBe(true);
    expect(state.current()?.activeSceneItemId).toBeNull();
    expect(state.current()?.focusedItemIds).toEqual([]);
  });

  it('retains newer focus/scene edits during a slow save and on conflict', async () => {
    await state.open('campaign-a', 'session-a');
    state.setFocus(['a']);
    const response = new Subject<WorkspaceData>();
    api.savePlayWorkspace.mockReturnValueOnce(response);
    const saving = state.flush();
    state.setFocus(['b', 'c']);
    state.activateScene('c');
    api.savePlayWorkspace.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    response.next({ ...workspace(), revision: 5, focusedItemIds: ['a'] });
    expect(await saving).toBe(false);
    expect(api.savePlayWorkspace.mock.calls[1][2]).toMatchObject({
      revision: 5,
      activeSceneItemId: 'c',
      focusedItemIds: ['b', 'c'],
    });
    expect(state.current()?.focusedItemIds).toEqual(['b', 'c']);
    expect(state.current()?.activeSceneItemId).toBe('c');
    expect(state.status()).toBe('failed');
  });

  it('inspects a fourth card without saving or changing scene, focus or Used state', async () => {
    const initial = {
      ...workspace(),
      active: ['a', 'b', 'd'],
      used: ['c'],
      activeSceneItemId: 'a',
      focusedItemIds: ['a', 'b', 'c'],
    };
    api.openPlayWorkspace.mockReturnValue(of(initial));
    await state.open('campaign-a', 'session-a');
    state.expand('a');
    state.inspect('d');
    expect(state.inspectionItemId()).toBe('d');
    expect(state.expandedItemId()).toBe('a');
    expect(state.current()).toEqual(initial);
    expect(state.hasUnsaved()).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(api.savePlayWorkspace).not.toHaveBeenCalled();
    state.focus('d'); // Full focus never chooses a replacement implicitly.
    state.replaceFocus(-1, 'd');
    state.replaceFocus(0.5, 'd');
    state.replaceFocus(0, 'c'); // No duplicates.
    expect(state.current()).toEqual(initial);
    expect(state.inspectionItemId()).toBe('d');
    state.replaceFocus(1, 'd');
    expect(state.current()).toEqual({ ...initial, focusedItemIds: ['a', 'd', 'c'] });
    expect(state.inspectionItemId()).toBeNull();
    expect(state.expandedItemId()).toBe('a');
    state.unfocus('a');
    expect(state.expandedItemId()).toBeNull();
    expect(state.current()?.activeSceneItemId).toBe('a');
  });

  it('fills only free focus slots and keeps expansion and inspection out of save payloads', async () => {
    await state.open('campaign-a', 'session-a');
    state.focus('a');
    state.focus('b');
    state.focus('a');
    state.focus('missing');
    state.expand('a');
    state.inspect('c');
    api.savePlayWorkspace.mockImplementation((_c, session, body) =>
      of({ session, ...body, revision: 5 }),
    );
    expect(await state.flush()).toBe(true);
    expect(api.savePlayWorkspace.mock.calls[0][2]).toEqual({
      revision: 4,
      active: ['a', 'b', 'c'],
      used: [],
      activeSceneItemId: null,
      focusedItemIds: ['a', 'b'],
    });
    expect(state.expandedItemId()).toBe('a');
    expect(state.inspectionItemId()).toBe('c');
    state.expand(null);
    expect(state.current()?.focusedItemIds).toEqual(['a', 'b']);
    expect(state.hasUnsaved()).toBe(false);
  });

  it('retains expansion across same-session opens, closes inspection and prunes removed expanded cards', async () => {
    const initial = { ...workspace(), focusedItemIds: ['a', 'b'] };
    api.openPlayWorkspace.mockReturnValue(of(initial));
    await state.open('campaign-a', 'session-a');
    state.expand('a');
    state.inspect('c');
    api.openPlayWorkspace.mockReturnValue(
      of({ ...initial, revision: 5, active: ['d', 'a', 'b', 'c'] }),
    );
    await state.open('campaign-a', 'session-a');
    expect(state.expandedItemId()).toBe('a');
    expect(state.inspectionItemId()).toBeNull();
    expect(state.current()?.focusedItemIds).toEqual(['a', 'b']);
    api.openPlayWorkspace.mockReturnValue(
      of({ ...initial, revision: 6, active: ['b', 'c'], focusedItemIds: ['b'] }),
    );
    await state.open('campaign-a', 'session-a');
    expect(state.expandedItemId()).toBeNull();
    expect(state.current()?.focusedItemIds).toEqual(['b']);
  });

  it('rejects late old-session presentation opens and keeps destination expansion', async () => {
    api.openPlayWorkspace.mockReturnValue(of({ ...workspace(), focusedItemIds: ['a'] }));
    await state.open('campaign-a', 'session-a');
    state.expand('a');
    const response = new Subject<WorkspaceData>();
    api.openPlayWorkspace.mockReturnValueOnce(response);
    const opening = state.open('campaign-a', 'session-a');
    state.clear();
    api.openPlayWorkspace.mockReturnValue(of({ ...workspace('session-b'), focusedItemIds: ['b'] }));
    await state.open('campaign-b', 'session-b');
    expect(state.expandedItemId()).toBeNull();
    state.expand('b');
    response.next({ ...workspace(), focusedItemIds: ['a'] });
    await opening;
    expect(state.current()?.session).toBe('session-b');
    expect(state.expandedItemId()).toBe('b');
    expect(state.inspectionItemId()).toBeNull();
  });

  it('shows a failed open and allows an explicit reload without creating local table state', async () => {
    api.openPlayWorkspace.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    await state.open('campaign-a', 'session-a');
    expect(state.current()).toBeNull();
    expect(state.status()).toBe('failed');
    await state.reload();
    expect(state.current()).toEqual(workspace());
  });
});

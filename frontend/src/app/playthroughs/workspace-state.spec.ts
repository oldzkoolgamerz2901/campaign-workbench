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

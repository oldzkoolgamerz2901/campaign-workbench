import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { PlayNoteControllerService, PlayNoteData } from '../../api/generated';
import { PlayNotesState } from './play-notes-state';
import { PlayWorkspaceState } from './workspace-state';
import { signal } from '@angular/core';
const note: PlayNoteData = {
  id: 'note',
  campaign: 'campaign',
  session: 'session',
  revision: 0,
  markdown: 'Draft',
  scene: null,
  resource: null,
  createdAt: '2026-10-24T12:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
  pinned: false,
};
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('PlayNote draft and delivery lifecycle', () => {
  let state: PlayNotesState;
  const api = { listPlayNotes: vi.fn(), createPlayNote: vi.fn(), editPlayNote: vi.fn() };
  const play = {
    current: signal<any>({ session: 'session', activeSceneItemId: 'scene-a' }),
    open: vi.fn(),
  };
  beforeEach(async () => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.listPlayNotes.mockReturnValue(of({ notes: [] }));
    play.current.set({ session: 'session', activeSceneItemId: 'scene-a' });
    play.open.mockReset();
    play.open.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: PlayNoteControllerService, useValue: api },
        { provide: PlayWorkspaceState, useValue: play },
      ],
    });
    state = TestBed.inject(PlayNotesState);
    await state.open('campaign', 'session');
  });
  afterEach(() => vi.restoreAllMocks());
  it('keeps the editor unavailable until the originating note context has loaded', async () => {
    state.clear();
    const history = new Subject<{ notes: PlayNoteData[] }>();
    api.listPlayNotes.mockReturnValue(history);
    const opening = state.open('campaign', 'session');
    expect(state.ready('campaign', 'session')).toBe(false);
    history.next({ notes: [] });
    await opening;
    expect(state.ready('campaign', 'session')).toBe(true);
    expect(state.ready('campaign', 'other')).toBe(false);
  });
  it('captures draft Scene once and retains the exact request after unknown delivery', async () => {
    state.setText('Draft', 'Scene A');
    state.setResource('resource', 'Scene A');
    play.current.set({ activeSceneItemId: 'scene-b' });
    api.createPlayNote
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of(note));
    expect(await state.save()).toBe(false);
    expect(state.text()).toBe('Draft');
    expect(state.locked()).toBe(true);
    const sent = api.createPlayNote.mock.calls[0][2];
    expect(sent).toMatchObject({ expectedScene: 'scene-a', resource: 'resource' });
    state.setText('Accidental changed retry', 'Scene B');
    expect(await state.save()).toBe(true);
    expect(api.createPlayNote.mock.calls[1][2]).toEqual(sent);
    expect(state.notes()).toEqual([note]);
    expect(state.hasUnsaved()).toBe(false);
  });
  it('requires explicit Scene recovery while retaining text and association', async () => {
    state.setText('Draft', 'Scene A');
    state.setResource('resource', 'Scene A');
    api.createPlayNote
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { code: 'playnotes.scene-context', detail: 'Scene changed' },
            }),
        ),
      )
      .mockReturnValueOnce(of(note));
    expect(await state.save()).toBe(false);
    expect(state.contextConflict()).toBe(true);
    expect(await state.save()).toBe(false);
    expect(api.createPlayNote).toHaveBeenCalledTimes(1);
    play.current.set({ activeSceneItemId: 'scene-b' });
    await state.useCurrentScene((id) => id ?? 'None');
    expect(state.text()).toBe('Draft');
    expect(state.resource()).toBe('resource');
    await state.save();
    const a = api.createPlayNote.mock.calls[0][2],
      b = api.createPlayNote.mock.calls[1][2];
    expect(b.expectedScene).toBe('scene-b');
    expect(b.operation).not.toBe(a.operation);
  });
  it('does not redirect in-flight create responses into a new session', async () => {
    const response = new Subject<PlayNoteData>();
    api.createPlayNote.mockReturnValue(response);
    state.setText('Draft', 'Scene A');
    const saving = state.save();
    await tick();
    state.clear();
    await state.open('campaign', 'other');
    response.next(note);
    expect(await saving).toBe(false);
    expect(state.notes()).toEqual([]);
    expect(state.text()).toBe('');
    expect(api.createPlayNote.mock.calls[0].slice(0, 2)).toEqual(['campaign', 'session']);
  });
  it('retains draft when navigation is cancelled and blocks export until explicit save', async () => {
    state.setText('Draft', 'Scene A');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await state.allowLeave()).toBe(false);
    expect(await state.flush()).toBe(false);
    expect(state.text()).toBe('Draft');
    expect(api.createPlayNote).not.toHaveBeenCalled();
  });
  it('edits/pins using the independent note revision and preserves immutable ordering', async () => {
    state.notes.set([note]);
    state.select(note);
    state.setPinned(true);
    api.editPlayNote.mockReturnValue(of({ ...note, pinned: true, revision: 1 }));
    expect(await state.save()).toBe(true);
    expect(api.editPlayNote.mock.calls[0].slice(0, 4)).toEqual([
      'campaign',
      'session',
      'note',
      { revision: 0, markdown: 'Draft', pinned: true, changeResource: false, resource: null },
    ]);
    expect(state.notes()[0].createdAt).toBe(note.createdAt);
  });
  it('ignores a history read overtaken by a successful save', async () => {
    const history = new Subject<{ notes: PlayNoteData[] }>();
    api.listPlayNotes.mockReturnValue(history);
    const reload = state.reloadHistory();
    state.setText('Draft', 'Scene A');
    api.createPlayNote.mockReturnValue(of(note));
    await state.save();
    history.next({ notes: [] });
    await reload;
    expect(state.notes()).toEqual([note]);
  });
  it('places an older retried capture by full-precision creation time, retaining ID ties', async () => {
    state.notes.set([
      { ...note, id: 'z', createdAt: '2026-10-24T12:00:00.000000002Z' },
      { ...note, id: 'b', createdAt: '2026-10-24T12:00:00.000000001Z' },
    ]);
    state.setText('Draft', 'Scene A');
    api.createPlayNote.mockReturnValue(
      of({ ...note, id: 'a', createdAt: '2026-10-24T12:00:00.000000001Z' }),
    );
    await state.save();
    expect(state.notes().map((n) => n.id)).toEqual(['z', 'b', 'a']);
  });
  it('retains stale edits and rebases only after explicit saved-revision review', async () => {
    state.notes.set([note]);
    state.select(note);
    state.setText('Local correction', 'Scene A');
    api.editPlayNote
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { code: 'playnotes.stale-revision' } }),
        ),
      )
      .mockReturnValueOnce(of({ ...note, revision: 3, markdown: 'Local correction' }));
    await state.save();
    expect(state.text()).toBe('Local correction');
    api.listPlayNotes.mockReturnValue(
      of({ notes: [{ ...note, revision: 2, markdown: 'Other edit' }] }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await state.reloadEdited();
    expect(state.text()).toBe('Local correction');
    await state.save();
    expect(api.editPlayNote.mock.calls[1][3].revision).toBe(2);
  });
});

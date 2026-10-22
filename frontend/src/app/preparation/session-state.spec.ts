import {
  PortableSessionControllerService,
  PlaythroughControllerService,
} from '../../api/generated';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { PreparationControllerService, SessionData } from '../../api/generated';
import { SessionState } from './session-state';

const session = (): SessionData => ({
  id: 'session-a',
  campaign: 'campaign-a',
  revision: 1,
  title: 'Original',
  objective: '',
  notes: '',
  items: [],
});
describe('Session working state', () => {
  let state: SessionState;
  const api = {
    saveSession: vi.fn(),
    openPlayWorkspace: vi.fn(),
    savePlayWorkspace: vi.fn(),
    openSession: vi.fn(),
    renderSession: vi.fn(),
    previewMarkdown: vi.fn(),
    addSessionSource: vi.fn(),
    addSessionDraft: vi.fn(),
    listSessions: vi.fn(),
    createSession: vi.fn(),
    importPortableSessions: vi.fn(),
  };
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.openSession.mockReturnValue(of(session()));
    api.renderSession.mockReturnValue(of({ notes: { html: '', links: [] }, items: [] }));
    api.previewMarkdown.mockReturnValue(of({ html: '', links: [] }));
    api.listSessions.mockReturnValue(of({ sessions: [] }));
    TestBed.configureTestingModule({
      providers: [
        SessionState,
        { provide: PreparationControllerService, useValue: api },
        { provide: PortableSessionControllerService, useValue: api },
        { provide: PlaythroughControllerService, useValue: api },
      ],
    });
    state = TestBed.inject(SessionState);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('keeps workspace changes separate from Preparation notes and revisions', async () => {
    const initial = {
      ...session(),
      items: ['a', 'b', 'c'].map((id) => ({ id, notes: '' }) as never),
    };
    api.openSession.mockReturnValue(of(initial));
    api.openPlayWorkspace.mockReturnValue(
      of({ session: initial.id, revision: 7, active: ['a', 'b', 'c'], used: [] }),
    );
    await state.open('campaign-a', 'session-a');
    await state.initializeTable();
    state.selectItem('b');
    state.moveTable('c', 0);
    state.markUsed('b');
    expect(state.play.current()).toMatchObject({ active: ['c', 'a'], used: ['b'] });
    expect(state.current()).toEqual(initial);
    expect(state.selectedItem()).toBe('b');
    state.returnToTable('b');
    const table = state.play.current()!;
    api.savePlayWorkspace.mockReturnValue(of({ ...table, revision: 8 }));
    expect(await state.play.flush()).toBe(true);
    expect(api.saveSession).not.toHaveBeenCalled();
    expect(api.savePlayWorkspace.mock.calls[0][2]).toEqual({
      revision: 7,
      active: ['b', 'c', 'a'],
      used: [],
    });
    state.edit({ notes: 'Preparation only' });
    api.saveSession.mockReturnValue(of({ ...initial, revision: 2, notes: 'Preparation only' }));
    expect(await state.flush()).toBe(true);
    expect(api.saveSession.mock.calls[0][2]).not.toHaveProperty('table');
    expect(state.play.current()?.revision).toBe(8);
  });
  it('flushes changed membership before opening the reconciled workspace', async () => {
    const initial = { ...session(), items: ['a', 'b'].map((id) => ({ id, notes: '' }) as never) };
    api.openSession.mockReturnValue(of(initial));
    await state.open('campaign-a', 'session-a');
    state.remove('a');
    api.saveSession.mockReturnValue(of({ ...initial, revision: 2, items: initial.items.slice(1) }));
    api.openPlayWorkspace.mockImplementation(() => {
      expect(api.saveSession).toHaveBeenCalledTimes(1);
      return of({ session: initial.id, revision: 9, active: ['b'], used: [] });
    });
    await state.initializeTable();
    expect(state.play.current()?.active).toEqual(['b']);
  });

  it('preserves failed local workspace edits while reloading Preparation in the same session', async () => {
    await state.open('campaign-a', 'session-a');
    api.openPlayWorkspace.mockReturnValue(
      of({ session: 'session-a', revision: 7, active: ['a', 'b'], used: [] }),
    );
    await state.initializeTable();
    state.markUsed('a');
    api.savePlayWorkspace.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    await state.play.flush();
    const table = state.play.current();
    state.edit({ notes: 'Discard these Preparation notes only' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await state.reload();
    expect(state.current()?.notes).toBe('');
    expect(state.play.current()).toEqual(table);
    expect(state.play.status()).toBe('failed');
    expect(state.play.hasUnsaved()).toBe(true);
    expect(api.savePlayWorkspace).toHaveBeenCalledTimes(1);
  });
  it('flushes notes before approval and pins both revisions while preserving edits during capture', async () => {
    await state.open('campaign-a', 'session-a');
    api.saveSession.mockReturnValue(of({ ...session(), revision: 2, notes: 'Saved notes' }));
    const result = new Subject<SessionData>();
    api.addSessionDraft.mockReturnValue(result);
    state.edit({ notes: 'Saved notes' });
    const approving = state.addDraft('draft-a', 7);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(api.addSessionDraft.mock.calls[0][2]).toEqual({
      revision: 2,
      draft: 'draft-a',
      draftRevision: 7,
    });
    expect(await state.allowLeave()).toBe(false);
    state.edit({ notes: 'New local notes' });
    result.next({
      ...session(),
      revision: 3,
      notes: 'Saved notes',
      items: [{ id: 'frozen' } as never],
    });
    result.complete();
    expect(await approving).toBe(true);
    expect(state.current()?.notes).toBe('New local notes');
    expect(state.current()?.revision).toBe(3);
    expect(state.selectedItem()).toBe('frozen');
    expect(state.hasUnsaved()).toBe(true);
  });
  it('retains the session on stale draft approval and ignores late approval responses after a campaign change', async () => {
    await state.open('campaign-a', 'session-a');
    api.addSessionDraft.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Review the newer draft' } }),
      ),
    );
    expect(await state.addDraft('draft-a', 1)).toBe(false);
    expect(state.current()).toEqual(session());
    expect(state.error()).toBe('Review the newer draft');
    const late = new Subject<SessionData>();
    api.addSessionDraft.mockReturnValue(late);
    const pending = state.addDraft('draft-a', 1);
    await Promise.resolve();
    await Promise.resolve();
    state.bindCampaign('campaign-b');
    late.next({ ...session(), revision: 2 });
    late.complete();
    expect(await pending).toBe(false);
    expect(state.current()).toBeNull();
    expect(state.notice()).toBe('');
  });
  it('ignores approval completion when the campaign changes during reader rendering', async () => {
    await state.open('campaign-a', 'session-a');
    const rendering = new Subject<{ notes: { html: string; links: never[] }; items: never[] }>();
    api.renderSession.mockReturnValueOnce(rendering);
    api.addSessionDraft.mockReturnValue(of({ ...session(), revision: 2 }));
    const pending = state.addDraft('draft-a', 1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    state.bindCampaign('campaign-b');
    rendering.next({ notes: { html: '', links: [] }, items: [] });
    rendering.complete();
    expect(await pending).toBe(false);
    expect(state.current()).toBeNull();
    expect(state.notice()).toBe('');
  });
  it('serializes slow saves and preserves newer edits until the next completed revision', async () => {
    await state.open('campaign-a', 'session-a');
    const first = new Subject<SessionData>(),
      second = new Subject<SessionData>();
    api.saveSession.mockReturnValueOnce(first).mockReturnValueOnce(second);
    state.edit({ notes: 'First' });
    const saved = state.flush();
    expect(state.status()).toBe('saving');
    state.edit({ notes: 'Newer' });
    expect(api.saveSession).toHaveBeenCalledTimes(1);
    first.next({ ...session(), revision: 2, notes: 'First' });
    first.complete();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.current()?.notes).toBe('Newer');
    expect(api.saveSession).toHaveBeenCalledTimes(2);
    expect(api.saveSession.mock.calls[1][2]).toMatchObject({ revision: 2, notes: 'Newer' });
    second.next({ ...session(), revision: 3, notes: 'Newer' });
    second.complete();
    expect(await saved).toBe(true);
    expect(state.status()).toBe('saved');
    expect(state.current()?.revision).toBe(3);
  });
  it('ignores a late Preparation save without clearing the new session save lifecycle', async () => {
    await state.open('campaign-a', 'session-a');
    const oldResponse = new Subject<SessionData>(),
      newResponse = new Subject<SessionData>();
    api.saveSession.mockReturnValueOnce(oldResponse).mockReturnValueOnce(newResponse);
    state.edit({ notes: 'Old notes' });
    const oldSaving = state.flush();
    state.bindCampaign('campaign-b');
    const next = { ...session(), id: 'session-b', campaign: 'campaign-b' };
    api.openSession.mockReturnValue(of(next));
    await state.open('campaign-b', 'session-b');
    state.edit({ notes: 'New notes' });
    const newSaving = state.flush();
    oldResponse.next({ ...session(), revision: 2, notes: 'Old notes' });
    expect(await oldSaving).toBe(false);
    expect(state.status()).toBe('saving');
    expect(state.current()?.notes).toBe('New notes');
    newResponse.next({ ...next, revision: 2, notes: 'New notes' });
    expect(await newSaving).toBe(true);
    expect(state.current()?.campaign).toBe('campaign-b');
  });
  it('retains failed edits, blocks navigation when discard is cancelled, and retries explicitly', async () => {
    await state.open('campaign-a', 'session-a');
    api.saveSession.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'Offline' } })),
    );
    state.edit({ notes: 'Keep me' });
    expect(await state.flush()).toBe(false);
    expect(state.status()).toBe('failed');
    expect(state.current()?.notes).toBe('Keep me');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await state.allowLeave()).toBe(false);
    expect(state.current()?.notes).toBe('Keep me');
    api.saveSession.mockReturnValue(of({ ...session(), revision: 2, notes: 'Keep me' }));
    expect(await state.flush()).toBe(true);
    expect(state.status()).toBe('saved');
  });
  it('does not silently rebase a stale revision or autosave further edits after conflict', async () => {
    await state.open('campaign-a', 'session-a');
    api.saveSession.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Changed elsewhere' } }),
      ),
    );
    state.edit({ notes: 'Local' });
    await state.flush();
    state.edit({ notes: 'Still local' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.saveSession).toHaveBeenCalledTimes(1);
    expect(state.current()?.revision).toBe(1);
    expect(state.current()?.notes).toBe('Still local');
  });
  it('ignores late session loads after switching identity', async () => {
    const late = new Subject<SessionData>();
    api.openSession
      .mockReturnValueOnce(late)
      .mockReturnValueOnce(of({ ...session(), id: 'session-b', campaign: 'campaign-b' }));
    const a = state.open('campaign-a', 'session-a');
    await state.open('campaign-b', 'session-b');
    late.next(session());
    late.complete();
    await a;
    expect(state.current()?.id).toBe('session-b');
    expect(state.current()?.campaign).toBe('campaign-b');
  });
  it('requires an explicit discard when the owner chooses to leave after failed saves', async () => {
    await state.open('campaign-a', 'session-a');
    api.saveSession.mockReturnValue(throwError(() => new Error('offline')));
    state.edit({ notes: 'Unsaved' });
    await state.flush();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await state.allowLeave()).toBe(true);
    expect(state.hasUnsaved()).toBe(false);
  });
  it('waits for source mutations before autosaving newer local notes', async () => {
    await state.open('campaign-a', 'session-a');
    const addition = new Subject<SessionData>();
    api.addSessionSource.mockReturnValue(addition);
    const item = {
      id: 'item',
      title: 'Frozen',
      markdown: '# Frozen',
      notes: '',
      anchors: {},
      provenance: {
        kind: 'source',
        authored: null,
        campaign: 'campaign-a',
        capture: 'capture',
        path: 'source.md',
        section: null,
        documentHash: 'hash',
        contentHash: 'hash',
      },
    };
    api.saveSession.mockReturnValue(
      of({ ...session(), revision: 3, notes: 'Typed during capture', items: [item] }),
    );
    const added = state.add('capture', 'source.md', null);
    await Promise.resolve();
    expect(state.mutating()).toBe(true);
    state.edit({ notes: 'Typed during capture' });
    const saved = state.flush();
    expect(api.saveSession).not.toHaveBeenCalled();
    addition.next({ ...session(), revision: 2, items: [item] });
    addition.complete();
    await added;
    expect(await saved).toBe(true);
    expect(api.saveSession.mock.calls[0][2]).toMatchObject({
      revision: 2,
      notes: 'Typed during capture',
    });
    expect(state.current()?.items).toHaveLength(1);
    expect(state.status()).toBe('saved');
  });
  it('ignores late creation results after the campaign changes', async () => {
    await state.open('campaign-a', 'session-a');
    const late = new Subject<SessionData>();
    api.createSession.mockReturnValue(late);
    const created = state.create('campaign-a', 'Late creation', '');
    await Promise.resolve();
    state.bindCampaign('campaign-b');
    late.next({ ...session(), id: 'late' });
    late.complete();
    expect(await created).toBeNull();
    expect(api.listSessions).not.toHaveBeenCalled();
  });
  it('does not repopulate a different campaign with a late import result', async () => {
    await state.open('campaign-a', 'session-a');
    const late = new Subject<{ sessions: [] }>();
    api.importPortableSessions.mockReturnValue(late);
    const file = { size: 2, text: async () => '{"version":1,"sessions":[]}' } as File;
    const imported = state.import('campaign-a', file);
    await Promise.resolve();
    state.bindCampaign('campaign-b');
    late.next({ sessions: [] });
    late.complete();
    await imported;
    expect(api.listSessions).not.toHaveBeenCalled();
    expect(state.sessions()).toEqual([]);
    expect(state.notice()).toBe('');
  });
  it('rejects import before its destination campaign is bound', async () => {
    const file = { size: 2, text: vi.fn() } as unknown as File;
    await state.import('campaign-a', file);
    expect(file.text).not.toHaveBeenCalled();
    expect(api.importPortableSessions).not.toHaveBeenCalled();
  });
  it('does not show an old import notice after switching during the list reload', async () => {
    state.bindCampaign('campaign-a');
    api.importPortableSessions.mockReturnValue(of({ sessions: [] }));
    const list = new Subject<{ sessions: [] }>();
    api.listSessions.mockReturnValue(list);
    const imported = state.import('campaign-a', {
      size: 2,
      text: async () => '{"version":1,"sessions":[]}',
    } as File);
    await Promise.resolve();
    await Promise.resolve();
    expect(api.listSessions).toHaveBeenCalledTimes(1);
    state.bindCampaign('campaign-b');
    list.next({ sessions: [] });
    list.complete();
    await imported;
    expect(state.sessions()).toEqual([]);
    expect(state.notice()).toBe('');
  });
  it('previews only selected or changed note fields in a 50-item session', async () => {
    const large: SessionData = {
      ...session(),
      notes: 'Session reminder',
      items: Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        title: `Entry ${i + 1}`,
        markdown: '# Material',
        notes: `Note ${i + 1}`,
        provenance: {
          kind: 'source',
          authored: null,
          campaign: 'campaign-a',
          capture: 'capture-a',
          path: 'source.md',
          section: null,
          documentHash: 'hash',
          contentHash: 'hash',
        },
        anchors: {},
      })),
    };
    api.openSession.mockReturnValue(of(large));
    await state.open('campaign-a', 'session-a');
    await vi.advanceTimersByTimeAsync(350);
    expect(api.previewMarkdown).toHaveBeenCalledTimes(2);
    expect(api.previewMarkdown.mock.calls.map((call) => call[1].markdown).sort()).toEqual([
      'Note 1',
      'Session reminder',
    ]);
    api.previewMarkdown.mockClear();
    state.editItemNotes('item-0', 'Changed visible note');
    await vi.advanceTimersByTimeAsync(350);
    expect(api.previewMarkdown).toHaveBeenCalledTimes(1);
    expect(api.previewMarkdown.mock.calls[0][1]).toEqual({ markdown: 'Changed visible note' });
    api.previewMarkdown.mockClear();
    state.edit({ title: 'Updated title' });
    state.move('item-0', 1);
    await vi.advanceTimersByTimeAsync(350);
    expect(api.previewMarkdown).not.toHaveBeenCalled();
    state.selectItem('item-49');
    await vi.advanceTimersByTimeAsync(350);
    expect(api.previewMarkdown).toHaveBeenCalledTimes(1);
    expect(api.previewMarkdown.mock.calls[0][1]).toEqual({ markdown: 'Note 50' });
    state.selectItem('item-0');
    await vi.advanceTimersByTimeAsync(350);
    expect(api.previewMarkdown).toHaveBeenCalledTimes(1);
  });
  it('keeps previews of other fields and rejects a late preview from the previous session', async () => {
    const late = new Subject<{ html: string; anchors: string[]; links: [] }>();
    api.previewMarkdown.mockReturnValueOnce(late);
    await state.open('campaign-a', 'session-a');
    await vi.advanceTimersByTimeAsync(350);
    api.openSession.mockReturnValue(
      of({ ...session(), id: 'session-b', campaign: 'campaign-b', notes: 'New campaign' }),
    );
    api.previewMarkdown.mockReturnValue(
      of({ html: '<p>New campaign</p>', anchors: [], links: [] }),
    );
    await state.open('campaign-b', 'session-b');
    await vi.advanceTimersByTimeAsync(350);
    late.next({ html: '<p>Stale</p>', anchors: [], links: [] });
    late.complete();
    await Promise.resolve();
    expect(state.previews()['session'].html).toBe('<p>New campaign</p>');
    expect(Object.keys(state.previews())).toEqual(['session']);
  });
  it('stops a partial addition queue and retries only unfinished selections at the latest revision', async () => {
    await state.open('campaign-a', 'session-a');
    const firstItem = {
      id: 'overview',
      title: 'Overview',
      markdown: '# Overview',
      notes: '',
      anchors: {},
      provenance: {
        kind: 'source',
        authored: null,
        campaign: 'campaign-a',
        capture: 'pinned',
        path: 'adventure.md',
        section: null,
        documentHash: 'h',
        contentHash: 'h',
      },
    };
    const sceneItem = {
      ...firstItem,
      id: 'scene',
      title: 'Scene',
      provenance: { ...firstItem.provenance, path: 'scene.md', section: 'nested' },
    };
    api.addSessionSource
      .mockReturnValueOnce(of({ ...session(), revision: 2, items: [firstItem] }))
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 503, error: { detail: 'Temporary failure' } }),
        ),
      )
      .mockReturnValueOnce(of({ ...session(), revision: 3, items: [firstItem, sceneItem] }));
    await state.startAdditions('pinned', [
      { path: 'adventure.md', section: null },
      { path: 'scene.md', section: 'nested' },
    ]);
    expect(state.additions().map((a) => a.status)).toEqual(['completed', 'failed']);
    expect(state.current()?.items).toHaveLength(1);
    expect(state.queueRunning()).toBe(false);
    await state.retryAdditions();
    expect(api.addSessionSource.mock.calls.map((c) => c[2])).toEqual([
      { revision: 1, capture: 'pinned', path: 'adventure.md', section: null },
      { revision: 2, capture: 'pinned', path: 'scene.md', section: 'nested' },
      { revision: 2, capture: 'pinned', path: 'scene.md', section: 'nested' },
    ]);
    expect(state.current()?.items.map((i) => i.id)).toEqual(['overview', 'scene']);
    expect(state.additions().map((a) => a.status)).toEqual(['completed', 'completed']);
  });
  it('guards a running queue and preserves notes typed during sequential captures', async () => {
    await state.open('campaign-a', 'session-a');
    const late = new Subject<SessionData>();
    api.addSessionSource
      .mockReturnValueOnce(late)
      .mockReturnValueOnce(of({ ...session(), revision: 4, notes: 'Keep edits' }));
    api.saveSession.mockReturnValue(of({ ...session(), revision: 3, notes: 'Keep edits' }));
    const running = state.startAdditions('capture', [
      { path: 'a.md', section: null },
      { path: 'b.md', section: 'subtree' },
    ]);
    await Promise.resolve();
    expect(await state.allowLeave()).toBe(false);
    expect(await state.add('other', 'unselected.md', null)).toBe(false);
    state.edit({ notes: 'Keep edits' });
    late.next({ ...session(), revision: 2 });
    await running;
    expect(api.saveSession.mock.calls[0][2]).toMatchObject({ revision: 2, notes: 'Keep edits' });
    expect(api.addSessionSource.mock.calls[1][2]).toMatchObject({
      revision: 3,
      path: 'b.md',
      section: 'subtree',
    });
    expect(state.current()?.notes).toBe('Keep edits');
    expect(state.queueRunning()).toBe(false);
  });
});

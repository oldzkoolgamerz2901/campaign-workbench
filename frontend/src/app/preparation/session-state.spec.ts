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
    openSession: vi.fn(),
    renderSession: vi.fn(),
    previewMarkdown: vi.fn(),
    addSessionSource: vi.fn(),
    listSessions: vi.fn(),
    createSession: vi.fn(),
    importSessions: vi.fn(),
  };
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.openSession.mockReturnValue(of(session()));
    api.renderSession.mockReturnValue(of({ notes: { html: '', links: [] }, items: [] }));
    api.previewMarkdown.mockReturnValue(of({ html: '', links: [] }));
    api.listSessions.mockReturnValue(of({ sessions: [] }));
    TestBed.configureTestingModule({
      providers: [SessionState, { provide: PreparationControllerService, useValue: api }],
    });
    state = TestBed.inject(SessionState);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    api.importSessions.mockReturnValue(late);
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
    expect(api.importSessions).not.toHaveBeenCalled();
  });
  it('does not send an import if the campaign changes while reading the file', async () => {
    state.bindCampaign('campaign-a');
    let finishRead!: (text: string) => void;
    const text = new Promise<string>((resolve) => {
      finishRead = resolve;
    });
    const imported = state.import('campaign-a', { size: 2, text: () => text } as File);
    state.bindCampaign('campaign-b');
    finishRead('{"version":1,"sessions":[]}');
    await imported;
    expect(api.importSessions).not.toHaveBeenCalled();
    expect(state.notice()).toBe('');
  });
  it('does not show an old import notice after switching during the list reload', async () => {
    state.bindCampaign('campaign-a');
    api.importSessions.mockReturnValue(of({ sessions: [] }));
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

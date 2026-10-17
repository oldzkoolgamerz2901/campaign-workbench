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
});

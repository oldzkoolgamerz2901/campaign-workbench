import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CardLibraryControllerService,
  SessionLibraryControllerService,
  SourceControllerService,
  LibraryEntry,
  LibraryAddResult,
  LibraryDocument,
  SessionLibrary,
} from '../../api/generated';
import { UnifiedLibraryState } from './unified-library-state';
import { LibraryState } from './library-state';
import { WritingState } from '../writing/writing-state';
import { SessionState } from '../preparation/session-state';
const entry: LibraryEntry = {
  key: 'card:a',
  card: 'a',
  title: 'Alpha',
  ready: true,
  conflicts: [],
  sources: [{ path: 'a.md', capture: 'capture', state: 'current' }],
};
describe('Unified Library destinations and representation safety', () => {
  const api = { listLibraryCards: vi.fn(), readLibraryCard: vi.fn(), editLibrarySource: vi.fn() };
  const sessions = { listSessionLibraryCards: vi.fn(), addSessionLibraryCard: vi.fn() };
  const sources = { refreshLibrary: vi.fn() };
  const writing = { flush: vi.fn() };
  const preparation = {
    flush: vi.fn(),
    play: { flush: vi.fn() },
    current: signal(null),
    invalidateLibraryMembership: vi.fn(),
  };
  let state: UnifiedLibraryState;
  const catalogue = (session: string, entries = [entry]): SessionLibrary => ({
    session,
    revision: 4,
    capture: 'capture',
    entries: entries.map((e) => ({ entry: e, state: 'READY', matches: [] })),
  });
  beforeEach(() => {
    vi.resetAllMocks();
    writing.flush.mockResolvedValue(true);
    preparation.flush.mockResolvedValue(true);
    preparation.play.flush.mockResolvedValue(true);
    api.listLibraryCards.mockReturnValue(
      of({ campaign: 'campaign', capture: 'capture', entries: [entry] }),
    );
    api.readLibraryCard.mockImplementation((_campaign, _key, _capture, revision, _path, draft) =>
      of({ entry: { ...entry, ...(draft ? { draft, revision } : {}) }, markdown: '# Alpha' }),
    );
    sessions.listSessionLibraryCards.mockImplementation((_c, s) => of(catalogue(s)));
    sessions.addSessionLibraryCard.mockReturnValue(
      of({ added: true, items: ['item'], session: { id: 'one' } }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: CardLibraryControllerService, useValue: api },
        { provide: SessionLibraryControllerService, useValue: sessions },
        { provide: SourceControllerService, useValue: sources },
        { provide: LibraryState, useValue: { selected: signal({ id: 'campaign' }) } },
        { provide: WritingState, useValue: writing },
        { provide: SessionState, useValue: preparation },
      ],
    });
    state = TestBed.inject(UnifiedLibraryState);
  });
  it('never chooses a recently used session; switching destination preserves reader and filters', async () => {
    await state.bind('campaign', '');
    await state.open(entry);
    await state.search('Alpha');
    expect(state.session()).toBe('');
    expect(sessions.listSessionLibraryCards).not.toHaveBeenCalled();
    const document = state.document();
    await state.bind('campaign', 'two');
    expect(state.document()).toBe(document);
    expect(state.query()).toBe('Alpha');
    expect(state.revision()).toBe(4);
    await state.bind('other', '');
    expect(state.document()).toBeNull();
    expect(state.query()).toBe('');
  });
  it('reads the exact Draft ID/revision and capture, with Document selected first', async () => {
    await state.bind('campaign', '');
    state.mode.set('card');
    await state.open({ ...entry, draft: 'draft', revision: 7 });
    expect(api.readLibraryCard).toHaveBeenLastCalledWith(
      'campaign',
      'card:a',
      'capture',
      7,
      undefined,
      'draft',
      'body',
      false,
      { httpHeaderAccept: 'application/json' },
    );
    expect(state.mode()).toBe('document');
  });
  it('passes an explicit conflicting Source path for inspection and blocks Add', async () => {
    await state.bind('campaign', 'one');
    const conflict = { ...entry, ready: false, conflicts: ['Duplicate identity'] };
    api.readLibraryCard.mockReturnValue(of({ entry: conflict }));
    await state.open(conflict, 'alternate.md');
    await state.add();
    expect(api.readLibraryCard).toHaveBeenLastCalledWith(
      'campaign',
      'card:a',
      'capture',
      undefined,
      'alternate.md',
      undefined,
      'body',
      false,
      { httpHeaderAccept: 'application/json' },
    );
    expect(state.blocked()).toBe(true);
    expect(sessions.addSessionLibraryCard).not.toHaveBeenCalled();
  });
  it('captures destination on dispatch and ignores late responses after switching', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    const pending = new Subject<LibraryAddResult>();
    sessions.addSessionLibraryCard.mockReturnValue(pending);
    const adding = state.add();
    await vi.waitFor(() => expect(sessions.addSessionLibraryCard).toHaveBeenCalled());
    await state.bind('campaign', 'two');
    pending.next({ added: true, session: { id: 'one' }, items: ['old-item'] } as LibraryAddResult);
    await adding;
    expect(sessions.addSessionLibraryCard.mock.calls[0].slice(0, 2)).toEqual(['campaign', 'one']);
    expect(state.session()).toBe('two');
    expect(state.notice()).toBe('');
    expect(preparation.invalidateLibraryMembership).toHaveBeenCalledWith('campaign', 'one');
  });
  it('cancels before mutation if a session switches while saves are pending', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    let finish!: (ok: boolean) => void;
    writing.flush.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    const adding = state.add();
    await state.bind('campaign', 'two');
    finish(true);
    await adding;
    expect(sessions.addSessionLibraryCard).not.toHaveBeenCalled();
  });
  it('retains the selected reader after failed saves and permits a deliberate retry', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    const document = state.document();
    writing.flush.mockResolvedValue(false);
    await state.add();
    expect(state.error()).toContain('could not be saved');
    expect(state.document()).toBe(document);
    expect(sessions.addSessionLibraryCard).not.toHaveBeenCalled();
    writing.flush.mockResolvedValue(true);
    await state.add();
    expect(sessions.addSessionLibraryCard).toHaveBeenCalledTimes(1);
    expect(state.notice()).toBe('Added to session.');
    expect(state.document()).toBe(document);
  });
  it('rejects stale catalogue/reader responses without replacing a newer selection', async () => {
    await state.bind('campaign', 'one');
    const old = new Subject<LibraryDocument>();
    api.readLibraryCard.mockReturnValueOnce(old);
    const opening = state.open(entry);
    await state.open({ ...entry, key: 'other' });
    const document = state.document();
    old.next({ entry: { ...entry, title: 'Late' } });
    await opening;
    expect(state.document()).toBe(document);
    const late = new Subject<SessionLibrary>();
    sessions.listSessionLibraryCards.mockReturnValueOnce(late);
    const reload = state.reload();
    await state.bind('campaign', 'two');
    late.next(catalogue('one'));
    await reload;
    expect(state.session()).toBe('two');
    expect(state.loading()).toBe(false);
  });
  it('invalidates Preparation cache after an uncertain dispatched failure', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    sessions.addSessionLibraryCard.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    await state.add();
    expect(preparation.invalidateLibraryMembership).toHaveBeenCalledWith('campaign', 'one');
  });
  it('marks changed or deleted Draft representations stale, preserving the old reader', async () => {
    await state.bind('campaign', 'one');
    await state.open({ ...entry, draft: 'draft', revision: 1 });
    const old = state.document();
    await state.reload();
    expect(state.stale()).toBe(true);
    expect(state.document()).toBe(old);
    await state.reopen();
    expect(state.stale()).toBe(false);
    expect(state.document()?.entry?.draft).toBeUndefined();
  });
  it('reports stale mutation failure without substituting new content', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    sessions.addSessionLibraryCard.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Reload capture' } })),
    );
    await state.add();
    expect(state.stale()).toBe(true);
    expect(state.error()).toBe('Reload capture');
    expect(state.document()?.entry?.key).toBe('card:a');
  });
  it('reloads a hidden associated Draft without clearing search or filters', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    await state.search('needle');
    const draft = { ...entry, draft: 'associated', revision: 0 };
    sessions.listSessionLibraryCards.mockImplementation((_campaign, session, query) =>
      of(catalogue(session, query ? [] : [draft])),
    );
    api.listLibraryCards.mockReturnValue(of({ capture: 'capture', entries: [draft] }));
    await state.reload();
    expect(state.stale()).toBe(true);
    await state.reopen();
    expect(state.document()?.entry?.draft).toBe('associated');
    expect(state.query()).toBe('needle');
    expect(state.stale()).toBe(false);
  });
  it('uses the catalogue revision when a cached Preparation session is older', async () => {
    preparation.current.set({ id: 'one', campaign: 'campaign', revision: 1 } as never);
    await state.bind('campaign', 'one');
    await state.open(entry);
    await state.add();
    expect(sessions.addSessionLibraryCard.mock.calls[0][2].revision).toBe(4);
    preparation.current.set(null);
  });
  it('keeps query while Search all clears every criterion and unions diagnostic requests', async () => {
    await state.bind('campaign', '');
    await state.search('needle');
    await state.setFilters({ unclassified: true, issues: true, purposes: [], statuses: [] });
    expect(state.entries()).toHaveLength(1);
    await state.searchAll();
    expect(state.query()).toBe('needle');
    expect(state.filters()).toEqual({
      types: [],
      tags: [],
      purposes: [],
      statuses: [],
      unclassified: false,
      issues: false,
    });
  });
  it('requires explicit reload when a research reference representation changed', async () => {
    await state.bind('campaign', '');
    api.listLibraryCards.mockReturnValue(
      of({ capture: 'capture', entries: [{ ...entry, draft: 'draft', revision: 2 }] }),
    );
    await state.openKey('card:a', { capture: 'capture', draft: 'draft', revision: 1 });
    expect(api.readLibraryCard).not.toHaveBeenCalled();
    expect(state.stale()).toBe(true);
    expect(state.error()).toContain('reference changed');
    expect(state.selectedEntry()?.key).toBe('card:a');
  });
  it('reconciles an uncertain assembly result, skips completed cards and retains the pinned destination', async () => {
    const scene = { ...entry, key: 'card:scene', title: 'Scene' };
    await state.bind('campaign', 'one');
    await state.open(entry);
    let committed = false;
    sessions.listSessionLibraryCards.mockImplementation((_c, session) =>
      of({
        ...catalogue(session, [entry, scene]),
        entries: [entry, scene].map((e) => ({
          entry: e,
          state: committed && e.key === scene.key ? 'ALREADY_PREPARED' : 'READY',
          matches:
            committed && e.key === scene.key
              ? [{ item: 'scene-item', updateAvailable: false, canUpdate: false }]
              : [],
        })),
      }),
    );
    sessions.addSessionLibraryCard.mockImplementation((_c, _s, payload) => {
      if (payload.key === scene.key) {
        committed = true;
        return throwError(() => new Error('Connection lost after commit'));
      }
      return of({ added: true, items: ['overview'], session: { id: 'one' } });
    });
    await state.startAssembly([entry, scene]);
    expect(state.assembly().map((e) => e.status)).toEqual(['completed', 'failed']);
    await state.retryAssembly();
    expect(state.assembly().map((e) => e.status)).toEqual(['completed', 'completed']);
    expect(sessions.addSessionLibraryCard).toHaveBeenCalledTimes(2);
    expect(
      sessions.addSessionLibraryCard.mock.calls.every(
        (call) => call[0] === 'campaign' && call[1] === 'one',
      ),
    ).toBe(true);
  });
  it('stops assembly dispatch after closing during pending saves', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    let finish!: (ok: boolean) => void;
    writing.flush.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    const running = state.startAssembly([entry]);
    state.detach();
    finish(true);
    await running;
    expect(sessions.addSessionLibraryCard).not.toHaveBeenCalled();
    expect(state.assemblyRunning()).toBe(false);
  });
  it('requires review when an unfinished assembly representation changes', async () => {
    await state.bind('campaign', 'one');
    await state.open(entry);
    sessions.listSessionLibraryCards.mockReturnValue(
      of(catalogue('one', [{ ...entry, draft: 'changed', revision: 9 }])),
    );
    await state.startAssembly([entry]);
    expect(state.error()).toContain('Selected card changed');
    expect(state.assembly()[0].status).toBe('failed');
    expect(sessions.addSessionLibraryCard).not.toHaveBeenCalled();
  });
});

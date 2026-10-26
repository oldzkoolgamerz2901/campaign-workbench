import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import {
  PlayHistoryControllerService,
  PlayNoteControllerService,
  PlayHistoryPage,
} from '../../api/generated';
import { PlayHistoryState } from './play-history-state';

const empty: PlayHistoryPage = { entries: [], nextTime: null, nextId: null };
const target = { title: 'Captured', reference: { campaign: 'origin', card: 'card' } };
const entry = (id: string) => ({ sessionTitle: 'Previous', note: { id } }) as any;
describe('cross-session history request isolation', () => {
  const api = { resourcePlayHistory: vi.fn(), scenePlayHistory: vi.fn() };
  const notes = { playHistoryTargets: vi.fn() };
  let state: PlayHistoryState;
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset().mockReturnValue(of(empty)));
    notes.playHistoryTargets.mockReset().mockReturnValue(of({ targets: [] }));
    TestBed.configureTestingModule({
      providers: [
        PlayHistoryState,
        { provide: PlayHistoryControllerService, useValue: api },
        { provide: PlayNoteControllerService, useValue: notes },
      ],
    });
    state = TestBed.inject(PlayHistoryState);
    state.open('containing', 'current');
  });
  it('queries containing campaign independently from captured origin and query dimension', async () => {
    await state.show(target, 'scene');
    expect(api.scenePlayHistory.mock.calls[0].slice(0, 5)).toEqual([
      'containing',
      'origin',
      'card',
      false,
      20,
    ]);
    expect(api.scenePlayHistory.mock.calls[1][3]).toBe(true);
    expect(api.resourcePlayHistory).not.toHaveBeenCalled();
    await state.show({ title: 'Context only', reference: null }, 'resource');
    expect(api.resourcePlayHistory).not.toHaveBeenCalled();
  });
  it('rejects late history and target responses after campaign/session changes', async () => {
    const late = new Subject<PlayHistoryPage>();
    const targets = new Subject<any>();
    api.resourcePlayHistory.mockReturnValue(late);
    notes.playHistoryTargets.mockReturnValueOnce(targets);
    state.open('containing', 'old');
    const pending = state.show(target, 'resource');
    state.open('other', 'new');
    targets.next({ targets: [{ item: 'old', resource: target }] });
    late.next({ ...empty, entries: [entry('old')] });
    await pending;
    expect(state.entries()).toEqual([]);
    expect(state.targets()).toEqual([]);
    expect(state.loading()).toBe(false);
    expect(state.expanded()).toBe(false);
  });
  it('rejects a previous resource response after a new Scene query', async () => {
    const late = new Subject<PlayHistoryPage>();
    api.resourcePlayHistory.mockReturnValue(late);
    const pending = state.show(target, 'resource');
    api.scenePlayHistory.mockReturnValue(of({ ...empty, entries: [entry('scene')] }));
    await state.show(target, 'scene');
    late.next({ ...empty, entries: [entry('old')] });
    await pending;
    expect(state.entries().map((e) => e.note.id)).toEqual(['scene']);
  });
  it('retains loaded pages and exact cursor for retry after a failed next page', async () => {
    api.resourcePlayHistory.mockImplementation((_c, _o, _id, pins) =>
      of(
        pins
          ? empty
          : {
              entries: [entry('one')],
              nextTime: '2026-10-24T00:00:00.000000001Z',
              nextId: 'one',
            },
      ),
    );
    await state.show(target, 'resource');
    api.resourcePlayHistory.mockReturnValueOnce(throwError(() => new Error('offline')));
    await state.load(false, true);
    expect(state.entries().map((e) => e.note.id)).toEqual(['one']);
    expect(state.error()).toContain('Retry');
    api.resourcePlayHistory.mockReturnValueOnce(
      of({ ...empty, entries: [entry('one'), entry('two')] }),
    );
    await state.load(false, true);
    expect(api.resourcePlayHistory.mock.calls.at(-1)?.slice(5, 7)).toEqual([
      '2026-10-24T00:00:00.000000001Z',
      'one',
    ]);
    expect(state.entries().map((e) => e.note.id)).toEqual(['one', 'two']);
  });
});

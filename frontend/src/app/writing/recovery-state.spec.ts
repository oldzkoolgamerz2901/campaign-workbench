import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { RecoveryState } from './recovery-state';
import { WritingState } from './writing-state';
import {
  RecoveryControllerService,
  RecoveryIndex,
  RecoveryDetail,
  DraftData,
} from '../../api/generated';

const index = (id: string): RecoveryIndex => ({
  workspace: { id, name: id, restoredAt: '', drafts: 1, approved: 0, exports: 0 },
  records: [],
});
const draft: DraftData = {
  id: 'draft',
  campaign: 'origin',
  card: 'card',
  revision: 2,
  fields: {
    title: 'Draft',
    type: 'npc',
    status: 'draft',
    tags: [],
    summary: '',
    body: '',
    path: 'npc.md',
  },
};
const detail = (): RecoveryDetail => ({
  record: {
    key: 'draft:draft',
    kind: 'draft',
    draft: 'draft',
    revision: 2,
    title: 'Draft',
    type: 'npc',
  },
  snapshot: draft,
  preview: { classification: { metadata: null, issues: [] }, sections: [], anchors: {}, links: [] },
  markdown: null,
  hash: null,
  links: [],
  createdAt: null,
  report: null,
  acknowledged: null,
});
function setup(api: object, flush = vi.fn().mockResolvedValue(true)) {
  TestBed.configureTestingModule({
    providers: [
      { provide: RecoveryControllerService, useValue: api },
      { provide: WritingState, useValue: { campaign: () => 'origin', flush } },
    ],
  });
  return { state: TestBed.inject(RecoveryState), flush };
}
describe('Writing recovery', () => {
  it('ignores old workspace and record responses, including after leaving recovery', async () => {
    const first = new Subject<RecoveryIndex>(),
      second = new Subject<RecoveryIndex>(),
      pending = new Subject<RecoveryDetail>();
    const { state } = setup({
      getRecoveryWorkspace: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
      getRecoveryRecord: vi.fn().mockReturnValue(pending),
    });
    const old = state.open('one'),
      latest = state.open('two');
    second.next(index('two'));
    second.complete();
    await latest;
    first.next(index('one'));
    first.complete();
    await old;
    expect(state.index()?.workspace.id).toBe('two');
    const selected = state.select('draft:draft');
    state.deactivate();
    pending.next(detail());
    pending.complete();
    await selected;
    expect(state.detail()).toBeNull();
  });
  it('requires explicit current-draft copying and suppresses duplicate pending commands', async () => {
    const pending = new Subject<DraftData>(),
      api = { copyRecoveredDraft: vi.fn().mockReturnValue(pending) };
    const { state } = setup(api);
    state.index.set(index('workspace'));
    state.detail.set(detail());
    await state.copy('');
    expect(api.copyRecoveredDraft).not.toHaveBeenCalled();
    const copying = state.copy('destination');
    await state.copy('destination');
    expect(api.copyRecoveredDraft).toHaveBeenCalledTimes(1);
    expect(api.copyRecoveredDraft.mock.calls[0].slice(0, 2)).toEqual([
      'workspace',
      { draft: 'draft', campaign: 'destination' },
    ]);
    pending.next({ ...draft, id: 'fresh', campaign: 'destination', revision: 0 });
    pending.complete();
    await copying;
    expect(state.copied()?.id).toBe('fresh');
    expect(state.detail()?.snapshot.id).toBe('draft');
  });
  it('blocks backup after save failure and retains explicit retry state after download errors', async () => {
    const api = {
      downloadWritingArchive: vi.fn().mockReturnValue(throwError(() => new Error('offline'))),
    };
    const { state, flush } = setup(api, vi.fn().mockResolvedValue(false));
    await state.backup('origin');
    expect(flush).toHaveBeenCalled();
    expect(api.downloadWritingArchive).not.toHaveBeenCalled();
    expect(state.error()).toContain('Download failed');
    flush.mockResolvedValue(true);
    await state.backup('origin');
    expect(api.downloadWritingArchive).toHaveBeenCalledTimes(1);
    expect(state.busy()).toBe(false);
  });
  it('rejects oversized upload before sending and reloads after an uncertain import result', async () => {
    const api = {
      restoreWritingArchive: vi.fn().mockReturnValue(throwError(() => new Error('lost response'))),
      listRecoveryWorkspaces: vi.fn().mockReturnValue(of({ workspaces: [] })),
    };
    const { state } = setup(api);
    await state.restore({ size: 64 * 1024 * 1024 + 1 } as File);
    expect(api.restoreWritingArchive).not.toHaveBeenCalled();
    await state.restore(new File(['{}'], 'archive.json'));
    expect(api.listRecoveryWorkspaces).toHaveBeenCalled();
    expect(state.error()).toContain('uncertain');
    expect(state.busy()).toBe(false);
  });
  it('keeps transfer protection active while refreshing after a successful import', async () => {
    const refreshed = new Subject<{ workspaces: RecoveryIndex['workspace'][] }>();
    const api = {
      restoreWritingArchive: vi.fn().mockReturnValue(of(index('saved').workspace)),
      listRecoveryWorkspaces: vi.fn().mockReturnValue(refreshed),
      getRecoveryWorkspace: vi.fn().mockReturnValue(of(index('saved'))),
    };
    const { state } = setup(api);
    const importing = state.restore(new File(['{}'], 'archive.json'));
    await Promise.resolve();
    expect(state.busy()).toBe(true);
    await state.restore(new File(['{}'], 'duplicate.json'));
    expect(api.restoreWritingArchive).toHaveBeenCalledTimes(1);
    refreshed.next({ workspaces: [index('saved').workspace] });
    refreshed.complete();
    await importing;
    expect(state.busy()).toBe(false);
    expect(state.index()?.workspace.id).toBe('saved');
  });
});

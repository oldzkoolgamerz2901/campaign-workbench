import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import {
  WritingControllerService,
  ArtworkControllerService,
  DraftData,
  DraftPreview,
  ExportInspection,
  BASE_PATH,
} from '../../api/generated';
import { WritingState } from './writing-state';

const draft = (campaign = 'a'): DraftData => ({
  id: `draft-${campaign}`,
  card: `card-${campaign}`,
  campaign,
  revision: 0,
  fields: {
    title: 'Mira',
    type: 'npc',
    status: 'draft',
    tags: [],
    summary: '',
    body: '',
    path: 'npcs/mira.md',
  },
});

describe('Writing generated-client transport', () => {
  it('sends atomic artwork replacement through the generated multipart operation with JSON success media type', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:transport');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '' },
      ],
    });
    const state = TestBed.inject(WritingState),
      http = TestBed.inject(HttpTestingController);
    state.current.set(draft());
    const file = new File(['image'], 'portrait.png', { type: 'image/png' });
    state.selectArtwork(file);
    const saving = state.flush();
    const request = http.expectOne('/api/campaigns/a/drafts/draft-a/artwork');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    expect(request.request.body.get('image')).toBe(file);
    expect(JSON.parse(request.request.body.get('metadata'))).toMatchObject({
      revision: 0,
      fields: draft().fields,
      imageAction: 'replace',
    });
    request.flush({ ...draft(), revision: 1, image: { hash: 'acknowledged' } });
    expect(await saving).toBe(true);
    expect(state.current()?.image?.hash).toBe('acknowledged');
    state.deactivate();
    http.verify();
    vi.restoreAllMocks();
  });
  it('requests successful JSON rather than the Problem Details response media type', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '' },
      ],
    });
    const state = TestBed.inject(WritingState),
      http = TestBed.inject(HttpTestingController);
    const pending = state.selectCampaign('campaign');
    const request = http.expectOne('/api/campaigns/campaign/drafts');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush({ drafts: [], catalog: { types: ['npc'], statuses: ['draft'], templates: {} } });
    await pending;
    expect(state.catalog()?.types).toEqual(['npc']);
    http.verify();
    state.deactivate();
  });
});
const preview = (): DraftPreview => ({
  layout: null,
  preview: { classification: { metadata: null, issues: [] }, sections: [], anchors: {}, links: [] },
  pathIssues: [],
});
describe('Writing working edits', () => {
  let state: WritingState;
  const api = {
    listDrafts: vi.fn(),
    openDraft: vi.fn(),
    createDraft: vi.fn(),
    saveDraft: vi.fn(),
    replaceDraftArtwork: vi.fn(),
    previewDraft: vi.fn(),
    listDraftExports: vi.fn(),
    forkDraft: vi.fn(),
    inspectDraftExport: vi.fn(),
    createDraftExport: vi.fn(),
    deleteDraft: vi.fn(),
  };
  beforeEach(async () => {
    vi.useFakeTimers();
    Object.values(api).forEach((f) => f.mockReset());
    api.listDrafts.mockImplementation((campaign: string) =>
      of({
        drafts: [draft(campaign)],
        catalog: { types: ['npc', 'scene'], statuses: ['draft'], templates: {} },
      }),
    );
    api.listDraftExports.mockReturnValue(of({ artifacts: [] }));
    api.openDraft.mockReturnValue(of(draft()));
    api.previewDraft.mockReturnValue(of(preview()));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: WritingControllerService, useValue: api },
        { provide: ArtworkControllerService, useValue: api },
      ],
    });
    state = TestBed.inject(WritingState);
    await state.selectCampaign('a');
    await state.open('draft-a');
  });
  afterEach(() => {
    state.deactivate();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('acknowledges an image separately from text edited during upload and releases its preview', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const upload = new Subject<DraftData>();
    const text = new Subject<DraftData>();
    api.replaceDraftArtwork.mockReturnValue(upload);
    api.saveDraft.mockReturnValue(text);
    const file = new File(['image'], 'local.png', { type: 'image/png' });
    state.selectArtwork(file);
    expect(state.localArtwork()).toBe('blob:pending');
    const saving = state.flush();
    state.edit({ body: 'Text entered during upload', backText: 'Back entered during upload' });
    const image = { hash: 'saved-image' };
    upload.next({ ...draft(), revision: 1, image });
    upload.complete();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.current()?.image).toEqual(image);
    expect(state.current()?.fields.body).toBe('Text entered during upload');
    expect(state.current()?.fields.backText).toBe('Back entered during upload');
    expect(state.pendingArtwork()).toBe('keep');
    expect(revoke).toHaveBeenCalledWith('blob:pending');
    expect(api.saveDraft.mock.calls[0][2]).toMatchObject({
      revision: 1,
      imageAction: 'keep',
      fields: { backText: 'Back entered during upload' },
    });
    text.next({ ...draft(), revision: 2, image });
    text.complete();
    expect(await saving).toBe(true);
    expect(api.replaceDraftArtwork).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('retains a newer selection and removal while an older image is saving', async () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:one')
      .mockReturnValueOnce('blob:two');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const upload = new Subject<DraftData>();
    const removal = new Subject<DraftData>();
    api.replaceDraftArtwork.mockReturnValue(upload);
    api.saveDraft.mockReturnValue(removal);
    state.selectArtwork(new File(['one'], 'one.png'));
    const saving = state.flush();
    state.selectArtwork(new File(['two'], 'two.webp'));
    expect(revoke).toHaveBeenCalledWith('blob:one');
    state.removeArtwork();
    expect(revoke).toHaveBeenCalledWith('blob:two');
    upload.next({ ...draft(), revision: 1, image: { hash: 'one' } });
    upload.complete();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.pendingArtwork()).toBe('remove');
    expect(api.saveDraft.mock.calls[0][2]).toMatchObject({ revision: 1, imageAction: 'remove' });
    removal.next({ ...draft(), revision: 2, image: null });
    removal.complete();
    expect(await saving).toBe(true);
    expect(state.current()?.image).toBeNull();
  });
  it('rejects oversized files and retains a failed upload for retry and guarded discard', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retry');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    state.selectArtwork({ name: 'large.png', size: 10 * 1024 * 1024 + 1 } as File);
    expect(state.artworkError()).toContain('10 MiB');
    expect(state.status()).toBe('saved');
    const file = new File(['image'], 'valid.png');
    state.selectArtwork(file);
    api.replaceDraftArtwork.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    expect(await state.flush()).toBe(false);
    expect(state.localArtwork()).toBe('blob:retry');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await state.allowLeave()).toBe(false);
    expect(state.pendingArtwork()).toBe('replace');
    api.replaceDraftArtwork.mockReturnValue(of({ ...draft(), revision: 1, image: { hash: 'ok' } }));
    expect(await state.flush()).toBe(true);
    expect(api.replaceDraftArtwork.mock.calls.at(-1)?.[3]).toBe(file);
    expect(revoke).toHaveBeenCalledWith('blob:retry');
  });
  it('uploads a newer file only after the first acknowledgement, then ignores a departed context', async () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:old')
      .mockReturnValueOnce('blob:new');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const first = new Subject<DraftData>(),
      second = new Subject<DraftData>();
    api.replaceDraftArtwork.mockReturnValueOnce(first).mockReturnValueOnce(second);
    state.selectArtwork(new File(['old'], 'old.png'));
    const saving = state.flush();
    const newer = new File(['new'], 'new.png');
    state.selectArtwork(newer);
    first.next({ ...draft(), revision: 1, image: { hash: 'old' } });
    first.complete();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.localArtwork()).toBe('blob:new');
    expect(api.replaceDraftArtwork.mock.calls[1][3]).toBe(newer);
    expect(JSON.parse(api.replaceDraftArtwork.mock.calls[1][2]).revision).toBe(1);
    state.deactivate();
    second.next({ ...draft(), revision: 2, image: { hash: 'new' } });
    second.complete();
    expect(await saving).toBe(false);
    expect(state.current()).toBeNull();
    expect(state.localArtwork()).toBeNull();
  });
  it('keeps a conflicted image until explicit reload discards it', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:conflict');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    state.selectArtwork(new File(['image'], 'conflict.png'));
    api.replaceDraftArtwork.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    expect(await state.flush()).toBe(false);
    expect(state.conflict()).toBe(true);
    expect(state.localArtwork()).toBe('blob:conflict');
    expect(await state.flush()).toBe(false);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await state.reload();
    expect(state.status()).toBe('saved');
    expect(state.pendingArtwork()).toBe('keep');
    expect(revoke).toHaveBeenCalledWith('blob:conflict');
  });
  it('serializes slow saves and never acknowledges newer edits as saved', async () => {
    const first = new Subject<DraftData>(),
      second = new Subject<DraftData>();
    api.saveDraft.mockReturnValueOnce(first).mockReturnValueOnce(second);
    state.edit({ body: 'first' });
    const saving = state.flush();
    state.edit({ body: 'newer' });
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    first.next({ ...draft(), revision: 1 });
    first.complete();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.current()?.fields.body).toBe('newer');
    expect(state.status()).toBe('saving');
    expect(api.saveDraft.mock.calls[1][2]).toMatchObject({
      revision: 1,
      fields: { body: 'newer' },
    });
    second.next({ ...draft(), revision: 2 });
    second.complete();
    expect(await saving).toBe(true);
    expect(state.status()).toBe('saved');
  });
  it('retains failures and blocks conflicting retries until explicit reload', async () => {
    api.saveDraft.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Changed elsewhere' } }),
      ),
    );
    state.edit({ summary: 'Keep my edit' });
    expect(await state.flush()).toBe(false);
    expect(state.current()?.fields.summary).toBe('Keep my edit');
    expect(state.conflict()).toBe(true);
    state.edit({ body: 'More local work' });
    expect(await state.flush()).toBe(false);
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await state.allowLeave()).toBe(false);
    expect(state.current()?.fields.body).toBe('More local work');
  });
  it('does not apply a late preview after editing or campaign switching', async () => {
    const late = new Subject<DraftPreview>();
    api.previewDraft.mockReturnValueOnce(late);
    await vi.advanceTimersByTimeAsync(200);
    state.edit({ body: 'New text' });
    late.next({ ...preview(), pathIssues: ['obsolete'] });
    late.complete();
    expect(state.preview()).toBeNull();
    // A cancelled preview must not return after selecting another campaign.
    await state.selectCampaign('b');
    expect(state.current()).toBeNull();
    expect(state.preview()).toBeNull();
  });
  it('keeps drafts in one group and supports case-insensitive tag filtering', () => {
    state.drafts.set([
      { ...draft(), fields: { ...draft().fields, tags: ['Harbour'] } },
      { ...draft(), id: 'scene', fields: { ...draft().fields, type: 'scene' } },
    ]);
    state.filterTag.set(' harbour ');
    expect(state.filtered().map((d) => d.id)).toEqual(['draft-a']);
    state.group.set('scene');
    expect(state.filtered()).toEqual([]);
  });
  it('never redirects an initiating create or open action into a newly selected campaign', async () => {
    const creating = state.create('npc', false);
    await state.selectCampaign('b');
    await creating;
    expect(api.createDraft).not.toHaveBeenCalled();
    expect(state.campaign()).toBe('b');
    expect(state.current()).toBeNull();
    const opening = state.open('draft-b');
    await state.selectCampaign('a');
    await opening;
    // Only the initial beforeEach open has issued a request.
    expect(api.openDraft).toHaveBeenCalledTimes(1);
    expect(state.current()).toBeNull();
  });
  it('keeps edits protected when an explicit reload fails', async () => {
    state.edit({ body: 'Unsaved body' });
    api.saveDraft.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    await state.flush();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.openDraft.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    await state.reload();
    expect(state.current()?.fields.body).toBe('Unsaved body');
    expect(state.status()).toBe('failed');
  });
  it('restores the saved list entry when failed local edits are explicitly discarded', async () => {
    state.edit({ title: 'Local only' });
    api.saveDraft.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    await state.flush();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await state.allowLeave()).toBe(true);
    expect(state.drafts()[0].fields.title).toBe('Mira');
  });
  it('flushes pending edits before inspection and invalidates reports immediately on edits or capture changes', async () => {
    const saving = new Subject<DraftData>();
    api.saveDraft.mockReturnValue(saving);
    api.inspectDraftExport.mockReturnValue(
      of({
        revision: 1,
        capture: 'capture',
        fingerprint: 'checked',
        errors: [],
        warnings: [],
        links: [],
        targetRevisions: {},
        path: 'npc.md',
        markdown: 'bytes',
        hash: 'hash',
      }),
    );
    state.edit({ title: 'Saved first' });
    const inspecting = state.inspectExport('capture');
    expect(api.inspectDraftExport).not.toHaveBeenCalled();
    saving.next({ ...draft(), revision: 1 });
    saving.complete();
    await inspecting;
    expect(api.inspectDraftExport.mock.calls[0][2]).toEqual({ revision: 1, capture: 'capture' });
    expect(state.inspection()?.fingerprint).toBe('checked');
    state.contextChanged('new capture');
    expect(state.inspection()).toBeNull();
    await state.inspectExport('capture');
    state.edit({ body: 'newer content' });
    expect(state.inspection()).toBeNull();
  });
  it('ignores late inspection results and protects edits when a source copy fails', async () => {
    const pending = new Subject<ExportInspection>();
    api.inspectDraftExport.mockReturnValue(pending);
    const inspecting = state.inspectExport('capture');
    await Promise.resolve();
    state.edit({ body: 'Keep this' });
    pending.next({
      revision: 0,
      capture: 'capture',
      fingerprint: 'obsolete',
      errors: [],
      warnings: [],
      links: [],
      targetRevisions: {},
      path: 'npc.md',
      markdown: 'bytes',
      hash: 'hash',
    });
    pending.complete();
    await inspecting;
    expect(state.inspection()).toBeNull();
    api.saveDraft.mockReturnValue(
      of({ ...draft(), revision: 1, fields: { ...draft().fields, body: 'Keep this' } }),
    );
    api.forkDraft.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Capture replaced' } }),
      ),
    );
    expect(await state.fork('old', 'source.md', null)).toBe(false);
    expect(state.current()?.fields.body).toBe('Keep this');
    expect(state.error()).toBe('Capture replaced');
  });
  it('requires a fresh inspection after the backend rejects a stale export context', async () => {
    api.inspectDraftExport.mockReturnValue(
      of({
        revision: 0,
        capture: 'capture',
        fingerprint: 'checked',
        errors: [],
        warnings: ['Review'],
        links: [],
        targetRevisions: {},
        path: 'npc.md',
        markdown: 'bytes',
        hash: 'hash',
      }),
    );
    await state.inspectExport('capture');
    api.createDraftExport.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Targets changed' } }),
      ),
    );
    await state.prepareExport(true);
    expect(api.createDraftExport.mock.calls[0][2]).toMatchObject({
      fingerprint: 'checked',
      acknowledgeWarnings: true,
    });
    expect(state.inspection()).toBeNull();
    expect(state.exportError()).toBe('Targets changed');
    expect(state.current()?.id).toBe('draft-a');
  });
  it('cancels named deletion without flushing or changing working edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    state.edit({ title: 'Unsaved Mira' });
    expect(await state.deleteCurrent()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Unsaved Mira'));
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(api.deleteDraft).not.toHaveBeenCalled();
    expect(state.current()?.fields.title).toBe('Unsaved Mira');
  });
  it('deletes dirty invalid work without saving and clears the editor while preserving filters', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteDraft.mockReturnValue(of(undefined));
    state.group.set('npc');
    state.filterTag.set('reef');
    state.edit({ title: '', path: '../invalid' });
    expect(await state.deleteCurrent()).toBe(true);
    expect(api.deleteDraft.mock.calls[0]).toEqual(['a', 'draft-a', 0]);
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(state.current()).toBeNull();
    expect(state.drafts()).toEqual([]);
    expect(state.status()).toBe('saved');
    expect(state.preview()).toBeNull();
    expect(state.group()).toBe('npc');
    expect(state.filterTag()).toBe('reef');
    expect(state.notice()).toContain('Deleted');
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.saveDraft).not.toHaveBeenCalled();
  });
  it('waits for an issued save without saving newer local edits, and blocks navigation and duplicate deletion', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const saving = new Subject<DraftData>(),
      deletion = new Subject<void>();
    api.saveDraft.mockReturnValue(saving);
    api.deleteDraft.mockReturnValue(deletion);
    state.edit({ body: 'First edit' });
    const flushing = state.flush();
    state.edit({ body: 'Newer local edit' });
    const deleting = state.deleteCurrent();
    expect(state.deleting()).toBe(true);
    expect(api.deleteDraft).not.toHaveBeenCalled();
    expect(await state.allowLeave()).toBe(false);
    expect(await state.deleteCurrent()).toBe(false);
    await state.open('another');
    await state.create('npc', false);
    await state.selectCampaign('b');
    expect(state.campaign()).toBe('a');
    saving.next({ ...draft(), revision: 1, fields: { ...draft().fields, body: 'First edit' } });
    saving.complete();
    await flushing;
    await Promise.resolve();
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    expect(api.deleteDraft.mock.calls[0]).toEqual(['a', 'draft-a', 1]);
    expect(state.current()?.fields.body).toBe('Newer local edit');
    deletion.next();
    deletion.complete();
    expect(await deleting).toBe(true);
    expect(state.current()).toBeNull();
  });
  it('preserves edits after stale deletion, pauses autosave and requires explicit reload', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteDraft.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { detail: 'Changed elsewhere' } }),
      ),
    );
    state.edit({ body: 'Keep unsaved body' });
    expect(await state.deleteCurrent()).toBe(false);
    expect(state.current()?.fields.body).toBe('Keep unsaved body');
    expect(state.conflict()).toBe(true);
    expect(state.deleteFailed()).toBe(true);
    expect(state.error()).toContain('Changed elsewhere');
    state.edit({ summary: 'More local work' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await state.flush()).toBe(false);
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(await state.deleteCurrent()).toBe(false);
    expect(api.deleteDraft).toHaveBeenCalledTimes(1);
    await state.reload();
    expect(state.deleteFailed()).toBe(false);
    expect(state.conflict()).toBe(false);
  });
  it('retains local text after uncertain and missing results and permits an explicit delete retry', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteDraft
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 404, error: { detail: 'Draft missing' } }),
        ),
      )
      .mockReturnValueOnce(of(undefined));
    state.edit({ body: 'Local only' });
    expect(await state.deleteCurrent()).toBe(false);
    expect(state.deleteFailed()).toBe(true);
    expect(state.current()?.fields.body).toBe('Local only');
    expect(await state.deleteCurrent()).toBe(false);
    expect(state.current()?.fields.body).toBe('Local only');
    expect(state.error()).toContain('Draft missing');
    expect(await state.deleteCurrent()).toBe(true);
    expect(state.current()).toBeNull();
    expect(api.saveDraft).not.toHaveBeenCalled();
  });
  it('ignores preview/history responses after successful deletion and a late delete after context teardown', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const previews = new Subject<DraftPreview>(),
      histories = new Subject<{ artifacts: [] }>();
    api.previewDraft.mockReturnValue(previews);
    api.listDraftExports.mockReturnValue(histories);
    state.edit({ summary: 'Changed' });
    await vi.advanceTimersByTimeAsync(200);
    const history = state.loadHistory();
    api.deleteDraft.mockReturnValue(of(undefined));
    await state.deleteCurrent();
    previews.next(preview());
    previews.complete();
    histories.next({ artifacts: [] });
    histories.complete();
    await history;
    expect(state.preview()).toBeNull();
    expect(state.current()).toBeNull();
    await state.selectCampaign('b');
    await state.open('draft-b');
    const pending = new Subject<void>();
    api.deleteDraft.mockReturnValue(pending);
    const deleting = state.deleteCurrent();
    state.deactivate();
    pending.next();
    pending.complete();
    expect(await deleting).toBe(false);
    expect(state.campaign()).toBeNull();
    expect(state.notice()).not.toContain('Deleted “Mira”');
  });
  it('can delete after an issued save fails without forcing invalid local work to save again', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const saving = new Subject<DraftData>();
    api.saveDraft.mockReturnValue(saving);
    api.deleteDraft.mockReturnValue(of(undefined));
    state.edit({ path: '../invalid', body: 'Unsavable local work' });
    const flushing = state.flush();
    const deleting = state.deleteCurrent();
    saving.error(new HttpErrorResponse({ status: 0 }));
    await flushing;
    expect(await deleting).toBe(true);
    expect(api.deleteDraft.mock.calls[0]).toEqual(['a', 'draft-a', 0]);
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    expect(state.current()).toBeNull();
  });
});

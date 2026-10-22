import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { DraftData, DraftPreview, WritingControllerService } from '../../api/generated';
import { DraftChooser } from './draft-chooser';

const draft = (id: string, campaign = 'campaign-a'): DraftData => ({
  id,
  campaign,
  card: id,
  revision: 1,
  fields: {
    title: id,
    type: 'npc',
    status: 'draft',
    summary: '',
    tags: [],
    path: `${id}.md`,
    body: '# Body',
  },
});
const preview = (): DraftPreview => ({
  preview: {
    classification: { metadata: { title: 'Ready', purpose: 'session' }, issues: [] },
    sections: [],
    anchors: {},
    links: [],
  },
  pathIssues: [],
});

describe('Session draft chooser', () => {
  it('ignores an older selection check and clears saved drafts when the campaign changes', async () => {
    const first = new Subject<DraftPreview>(),
      second = new Subject<DraftPreview>();
    const api = {
      listDrafts: vi
        .fn()
        .mockReturnValue(of({ drafts: [draft('one'), draft('two')], catalog: { types: ['npc'] } })),
      previewDraft: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
    };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: WritingControllerService, useValue: api }],
    });
    const fixture = TestBed.createComponent(DraftChooser);
    fixture.componentRef.setInput('campaign', 'campaign-a');
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const old = component.select(draft('one'));
    const latest = component.select(draft('two'));
    expect(component.ready()).toBe(false);
    second.next(preview());
    second.complete();
    await latest;
    expect(component.ready()).toBe(true);
    first.next({ ...preview(), pathIssues: ['Old invalid path'] });
    first.complete();
    await old;
    expect(component.selected()?.id).toBe('two');
    expect(component.ready()).toBe(true);
    api.listDrafts.mockReturnValue(of({ drafts: [], catalog: { types: ['npc'] } }));
    fixture.componentRef.setInput('campaign', 'campaign-b');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.selected()).toBeNull();
    expect(component.preview()).toBeNull();
    expect(component.drafts()).toEqual([]);
  });
  it('keeps failed checks explicit and prevents approval of incomplete metadata', async () => {
    const api = {
      listDrafts: vi
        .fn()
        .mockReturnValue(of({ drafts: [draft('one')], catalog: { types: ['npc'] } })),
      previewDraft: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('offline')))
        .mockReturnValueOnce(
          of({
            ...preview(),
            preview: {
              ...preview().preview,
              classification: {
                metadata: null,
                issues: [{ severity: 'error', message: 'Title required' }],
              },
            },
          }),
        ),
    };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: WritingControllerService, useValue: api }],
    });
    const fixture = TestBed.createComponent(DraftChooser);
    fixture.componentRef.setInput('campaign', 'campaign-a');
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    await component.select(draft('one'));
    expect(component.ready()).toBe(false);
    expect(component.error()).toContain('Cannot check');
    await component.select(draft('one'));
    expect(component.ready()).toBe(false);
    expect(component.error()).toBe('');
  });
});

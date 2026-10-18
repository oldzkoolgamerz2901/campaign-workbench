import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import {
  CampaignControllerService,
  SourceControllerService,
  Campaign,
  SourceDocument,
  SearchResults,
  Library,
} from '../../api/generated';
import { LibraryState } from './library-state';

const first: Campaign = {
  id: 'first',
  name: 'First',
  directory: '/first',
  includes: ['**/*.md'],
  excludes: [],
  revision: 0,
};
const second: Campaign = { ...first, id: 'second', name: 'Second' };
describe('Campaign library request identity', () => {
  const campaigns = {
    listCampaigns: vi.fn(),
    registerCampaign: vi.fn(),
    selectCampaign: vi.fn(),
    configureCampaign: vi.fn(),
  };
  const sources = {
    getLibrary: vi.fn(),
    refreshLibrary: vi.fn(),
    getSourceDocument: vi.fn(),
    searchSources: vi.fn(),
  };
  let state: LibraryState;
  beforeEach(() => {
    vi.resetAllMocks();
    campaigns.selectCampaign.mockImplementation((id: string) =>
      of(id === 'first' ? first : second),
    );
    sources.getLibrary.mockImplementation((id: string) =>
      of({ campaign: id, capture: id + '-capture', needsRefresh: false, documents: [] }),
    );
    sources.refreshLibrary.mockImplementation((id: string) => sources.getLibrary(id));
    TestBed.configureTestingModule({
      providers: [
        LibraryState,
        { provide: CampaignControllerService, useValue: campaigns },
        { provide: SourceControllerService, useValue: sources },
      ],
    });
    state = TestBed.inject(LibraryState);
    state.campaigns.set([first, second]);
  });
  it('does not restore the old selection over a registration started during initialization', async () => {
    const listing = new Subject<{ campaigns: Campaign[]; selected: string | null }>();
    campaigns.listCampaigns.mockReturnValue(listing);
    campaigns.registerCampaign.mockReturnValue(of(first));
    const initializing = state.initialize();
    await state.register(first.name, first.directory);
    listing.next({ campaigns: [second], selected: second.id });
    await initializing;
    expect(state.selected()?.id).toBe(first.id);
    expect(state.campaigns().some((item) => item.id === first.id)).toBe(true);
  });
  it('discards reading and search responses after switching campaign', async () => {
    await state.select(first.id);
    const document = new Subject<SourceDocument>(),
      search = new Subject<SearchResults>();
    sources.getSourceDocument.mockReturnValue(document);
    sources.searchSources.mockReturnValue(search);
    const opening = state.open('old.md'),
      searching = state.search('needle');
    await state.select(second.id);
    document.next({
      campaign: first.id,
      capture: 'first-capture',
      path: 'old.md',
      sections: [],
      links: [],
    });
    search.next({
      campaign: first.id,
      capture: 'first-capture',
      hits: [{ path: 'old.md', heading: 'Old', section: 's', block: 'b', excerpt: 'needle' }],
    });
    await Promise.all([opening, searching]);
    expect(state.selected()?.id).toBe(second.id);
    expect(state.document()).toBeNull();
    expect(state.results()).toEqual([]);
  });
  it('discards an earlier search when a later search completes first', async () => {
    await state.select(first.id);
    const old = new Subject<SearchResults>();
    sources.searchSources
      .mockReturnValueOnce(old)
      .mockReturnValueOnce(of({ campaign: first.id, capture: 'first-capture', hits: [] }));
    const pending = state.search('old');
    await state.search('new');
    old.next({
      campaign: first.id,
      capture: 'first-capture',
      hits: [{ path: 'old.md', heading: 'Old', section: 's', block: 'b', excerpt: 'old' }],
    });
    await pending;
    expect(state.results()).toEqual([]);
  });
  it('retains pending rules when a refresh response arrives after configuration is saved', async () => {
    await state.select(first.id);
    const refresh = new Subject<Library>();
    sources.refreshLibrary.mockReturnValue(refresh);
    const pending = state.refresh();
    campaigns.configureCampaign.mockReturnValue(
      of({ ...first, revision: 1, includes: ['lore/**'] }),
    );
    await state.configure('lore/**', '');
    sources.getLibrary.mockReturnValue(
      of({ campaign: first.id, capture: 'new-capture', documents: [], needsRefresh: false }),
    );
    refresh.next({
      campaign: first.id,
      capture: 'new-capture',
      documents: [],
      needsRefresh: false,
    });
    await pending;
    expect(state.library()?.capture).toBe('new-capture');
    expect(state.library()?.needsRefresh).toBe(true);
  });
  it('marks saved rules pending without replacing captured documents', async () => {
    await state.select(first.id);
    campaigns.configureCampaign.mockReturnValue(
      of({ ...first, revision: 1, includes: ['lore/**'] }),
    );
    await state.configure('lore/**', '');
    expect(state.library()?.needsRefresh).toBe(true);
    expect(state.library()?.capture).toBe('first-capture');
    expect(campaigns.configureCampaign).toHaveBeenCalledWith('first', {
      includes: ['lore/**'],
      excludes: [],
      revision: 0,
    });
  });
  it('queries explicit play defaults, combines filters, and Search all retains the query without refreshing', async () => {
    await state.select(first.id);
    expect(sources.getLibrary.mock.calls.at(-1)?.slice(1, 5)).toEqual([
      new Set(),
      new Set(),
      new Set(['session']),
      new Set(['current']),
    ]);
    const refreshes = sources.refreshLibrary.mock.calls.length;
    sources.searchSources.mockReturnValue(
      of({ campaign: first.id, capture: 'first-capture', hits: [] }),
    );
    await state.setFilters({ types: ['npc', 'scene'], tags: ['combat'], statuses: ['draft'] });
    await state.search('needle');
    expect(sources.searchSources.mock.calls.at(-1)?.slice(2, 7)).toEqual([
      'needle',
      new Set(['npc', 'scene']),
      new Set(['combat']),
      new Set(['session']),
      new Set(['draft']),
    ]);
    await state.searchAll();
    expect(state.query()).toBe('needle');
    expect(sources.searchSources.mock.calls.at(-1)?.slice(3, 9)).toEqual([
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      false,
      false,
    ]);
    expect(sources.refreshLibrary).toHaveBeenCalledTimes(refreshes);
  });
  it('unions diagnostics and deduplicates exact passages without losing repeated-heading targets', async () => {
    await state.select(first.id);
    const hit = {
      path: 'bad.md',
      heading: 'Repeated',
      section: 'one',
      block: 'b1',
      excerpt: 'needle',
    };
    sources.getLibrary.mockReturnValue(
      of({
        campaign: first.id,
        capture: 'first-capture',
        documents: [{ path: 'bad.md' }],
        needsRefresh: false,
      }),
    );
    sources.searchSources
      .mockReturnValueOnce(of({ capture: 'first-capture', hits: [hit] }))
      .mockReturnValueOnce(
        of({ capture: 'first-capture', hits: [hit, { ...hit, section: 'two', block: 'b2' }] }),
      );
    await state.setFilters({ unclassified: true, issues: true, purposes: [], statuses: [] });
    await state.search('needle');
    expect(state.library()?.documents).toHaveLength(1);
    expect(state.groups()).toHaveLength(1);
    expect(state.groups()[0].hits.map((h) => h.block)).toEqual(['b1', 'b2']);
    expect(sources.searchSources.mock.calls.map((c) => c.slice(7, 9))).toEqual([
      [true, false],
      [false, true],
    ]);
  });
  it('rejects late filter results and invalidates search immediately while typing', async () => {
    await state.select(first.id);
    const old = new Subject<Library>();
    sources.getLibrary.mockReturnValueOnce(old);
    const pending = state.setFilters({ types: ['npc'] });
    await state.setFilters({ types: ['scene'] });
    old.next({
      campaign: first.id,
      capture: 'first-capture',
      documents: [{ path: 'old.md' }],
      needsRefresh: false,
    });
    await pending;
    expect(state.library()?.documents).toEqual([]);
    const search = new Subject<SearchResults>();
    sources.searchSources.mockReturnValue(search);
    const searching = state.search('old');
    await Promise.resolve();
    state.changeQuery('new');
    search.next({
      campaign: first.id,
      capture: 'first-capture',
      hits: [{ path: 'old.md', section: 's', block: 'b', heading: 'Old', excerpt: 'old' }],
    });
    await searching;
    expect(state.results()).toEqual([]);
  });
});

import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MIGRATED_CAMPAIGN_CARDS } from './reader-migrated-fixtures';
import { READER_CARDS, StudyCard, StudySection } from './reader-fixtures';

interface StudyItem { id: string; sourceId: string; section?: string; card: StudyCard; notes: string; }
interface StudySession { id: string; campaign: string; title: string; objective: string; notes: string; items: StudyItem[]; selectedId: string | null; }
let nextId = 0;
function capture(card: StudyCard, section?: StudySection): StudyItem {
 const copy = structuredClone(card);
 if (section) {
  copy.title += ' / ' + section.title;
  copy.sections = [structuredClone(section)];
  copy.summary = 'Selected section and its nested content only; no other document sections are included.';
  copy.rawOriginal = undefined;
 }
 return { id: 'study-item-' + ++nextId, sourceId: card.id, section: section?.title, card: copy, notes: '' };
}
function sampleSession(id: string, campaign: string, title: string, cards: StudyCard[], objective: string): StudySession {
 const items = cards.map(c => capture(c));
 return { id, campaign, title, objective, notes: '', items, selectedId: items[0]?.id ?? null };
}

function densitySession(): StudySession {
 const items=MIGRATED_CAMPAIGN_CARDS.flatMap(c=>[capture(c),...c.sections.slice(0,3).map(section=>capture(c,section))]);
 return {id:'density',campaign:'sea-witch',title:'Long session · 40 items',objective:'Density review: ten documents and thirty section captures, with deliberate overlap.',notes:'A disposable stress case for finding and navigating 30–50 prepared entries.',items,selectedId:items[0].id};
}

// Authorized throwaway experiment: can A assemble and B read the same compilation?
// /?prototype=preparation&study=reader&variant=A|B. All edits reset on refresh.
@Component({selector:'reader-study', imports:[FormsModule], templateUrl:'./reader-study.html', styleUrls:['./reader-study.css','./reader-study-navigation.css']})
export class ReaderStudy {
 readonly cards = [...MIGRATED_CAMPAIGN_CARDS, ...READER_CARDS];
 readonly campaigns = [{id:'sea-witch',title:'Sea Witch',description:'Migrated draft copies'}, {id:'hollow',title:'The Hollow Marches',description:'Invented stress fixtures'}];
 readonly campaign = signal('sea-witch');
 private route = inject(ActivatedRoute); private router = inject(Router);
 private params = toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 readonly variant = computed(() => this.params().get('variant') === 'B' ? 'B' : 'A');
 readonly names = {A:'Library desk',B:'Session folio'};
 readonly mode = signal<'prepare'|'read'>(this.route.snapshot.queryParamMap.get('variant') === 'B' ? 'read' : 'prepare');
 readonly sessions = signal<StudySession[]>([
  densitySession(),
  sampleSession('sanctuary','sea-witch','Sanctuary arrival',[this.cards[1],this.cards[0]],'Give the sanctuary room to breathe; keep Thomas’s knowledge boundaries clear.'),
  sampleSession('agelus','sea-witch','Following Agelus',[this.cards[2],this.cards[6]],'Read the island’s evidence before moving on to Greenbank.'),
  sampleSession('gate','hollow','The drowned gate',[READER_CARDS[0],READER_CARDS[1]],'Reach the bell tower using the clues the players choose.')
 ]);
 readonly activeIds = signal<Record<string,string>>({'sea-witch':'sanctuary',hollow:'gate'});
 readonly current = computed(() => this.sessions().find(s => s.id === this.activeIds()[this.campaign()])!);
 readonly campaignSessions = computed(() => this.sessions().filter(s => s.campaign === this.campaign()));
 readonly preparedQuery = signal('');
 readonly visibleItems = computed(() => this.current().items.map((item,index)=>({item,number:index+1})).filter(entry=>entry.item.card.title.toLowerCase().includes(this.preparedQuery().trim().toLowerCase())));
 readonly currentItem = computed(() => this.current().items.find(i => i.id === this.current().selectedId));
 readonly sourceSelection = signal(this.cards[0]);
 readonly inspectingPrepared = signal(this.mode() === 'read');
 readonly frozen = computed(() => this.inspectingPrepared() && !!this.currentItem());
 readonly selected = computed(() => this.frozen() ? this.currentItem()!.card : this.sourceSelection());
 readonly sessionsOpen = signal(false); readonly contentsOpen = signal(true);
 readonly library = signal(this.mode() !== 'read'); readonly notesOpen = signal(this.mode() === 'read');
 readonly outline = signal(false); readonly full = signal(false);
 readonly filtersOpen = signal(false);
 readonly category = signal('Play library'); readonly query = signal(''); readonly tag = signal('');
 readonly categories = ['Play library','Scene','NPC','Adventure','Guidance','Issues / unclassified'];
 readonly expanded = signal<string[]>([]); readonly focused = signal<string|null>(null); readonly notice = signal('');
 readonly sceneChooser = signal(false); readonly selectedScenes = signal<string[]>([]);
 readonly results = computed(() => this.cards.filter(c => c.id.startsWith('sw-') === (this.campaign() === 'sea-witch') && this.inCategory(c) && (!this.tag() || c.tags.includes(this.tag())) && this.matches(c)));
 readonly wordCount = computed(() => this.selected().sections.map(s => s.paragraphs.join(' ')).join(' ').trim().split(/\s+/).length);
 draftTitle = ''; draftObjective = '';
 private sourceScroll = 0;
 private preparationPanels = {library:true,notes:false};

 inCategory(c: StudyCard) { const cat=this.category(); return cat==='All content'||(cat==='Play library'?c.purpose==='play':cat==='Issues / unclassified'?!!c.issue:c.type===cat); }
 matches(c: StudyCard) {return [c.title,c.summary,...c.sections.flatMap(s=>[s.title,...s.paragraphs])].join(' ').toLowerCase().includes(this.query().trim().toLowerCase());}
 updateSession(patch: Partial<StudySession>) {const id=this.current().id;this.sessions.update(all=>all.map(s=>s.id===id?{...s,...patch}:s));}
 switchCampaign(id: string) {
  this.preparedQuery.set('');
  this.campaign.set(id);this.sourceSelection.set(id==='sea-witch'?this.cards[0]:READER_CARDS[0]);
  this.category.set('Play library');this.query.set('');this.tag.set('');this.draftTitle='';this.draftObjective='';
  this.mode.set('prepare');this.inspectingPrepared.set(false);this.library.set(true);this.notesOpen.set(false);this.contentsOpen.set(true);
  this.resetReader();this.notice.set('Campaign switched. Each campaign retains its own in-memory sessions.');this.layout('A');
 }
 openSession(id: string) {
  this.preparedQuery.set('');
  this.activeIds.update(ids=>({...ids,[this.campaign()]:id}));this.sessionsOpen.set(false);
  this.mode.set('prepare');this.inspectingPrepared.set(!!this.currentItem());this.library.set(true);this.contentsOpen.set(true);this.revealSelectedItem();
  this.resetReader();this.notice.set('Opened '+this.current().title);this.layout('A');
 }
 createSession() {
  const title=this.draftTitle.trim();if(!title)return;this.preparedQuery.set('');
  const session:StudySession={id:'study-session-'+ ++nextId,campaign:this.campaign(),title,objective:this.draftObjective.trim(),notes:'',items:[],selectedId:null};
  this.sessions.update(all=>[...all,session]);this.activeIds.update(ids=>({...ids,[this.campaign()]:session.id}));
  this.draftTitle='';this.draftObjective='';this.sessionsOpen.set(false);this.mode.set('prepare');this.inspectingPrepared.set(false);
  this.library.set(true);this.contentsOpen.set(true);this.notesOpen.set(false);this.resetReader();this.layout('A');
  this.notice.set('Session created. Browse and add material; there is no separate compile step.');
 }
 choose(c: StudyCard) {
  this.sourceSelection.set(c);this.inspectingPrepared.set(false);this.mode.set('prepare');this.sceneChooser.set(false);
  this.expanded.set([]);this.focused.set(null);this.notice.set('');this.sourceScroll=0;
  if(this.query().trim())this.revealMatch();else this.jumpTop();
 }
 browse() {
  this.mode.set('prepare');this.inspectingPrepared.set(false);this.library.set(true);this.sceneChooser.set(false);
  this.focused.set(null);this.layout('A');this.restoreSourceScroll();
 }
 selectItem(item: StudyItem) {
  if(!this.frozen())this.rememberSourceScroll();
  this.updateSession({selectedId:item.id});this.inspectingPrepared.set(true);this.resetReader();
 }
 setMode(mode: 'prepare'|'read') {
  if(mode==='read') {
   if(!this.current().items.length)return;
   if(!this.frozen())this.rememberSourceScroll();
   this.preparationPanels={library:this.library(),notes:this.notesOpen()};
   this.inspectingPrepared.set(true);this.library.set(false);this.notesOpen.set(true);this.outline.set(false);this.sessionsOpen.set(false);
   this.layout('B');this.mode.set(mode);this.resetReader();this.revealSelectedItem();
  } else {
   this.mode.set(mode);this.library.set(this.preparationPanels.library);this.notesOpen.set(this.preparationPanels.notes);this.layout('A');
   this.notice.set('Preparation resumed with the same session selection and notes.');
  }
 }
 addCard(card: StudyCard, section?: StudySection) {
  if(card.purpose==='guidance')return;
  const item=capture(card,section);this.updateSession({items:[...this.current().items,item],selectedId:item.id});
  this.contentsOpen.set(true);this.revealSelectedItem();this.notice.set('Added '+item.card.title+' to '+this.current().title+'. Your library position is unchanged.');
 }
 addDocument() {
  if(this.frozen())return;
  if(this.selected().type==='Adventure'){this.selectedScenes.set([]);this.sceneChooser.set(true);}
  else this.addCard(this.selected());
 }
 sceneOptions() {return (this.selected().sceneIds??['hall']).map(id=>this.related(id));}
 toggleScene(id: string) {this.selectedScenes.update(a=>a.includes(id)?a.filter(v=>v!==id):[...a,id]);}
 captureAdventure() {
  const overview=this.selected();this.addCard(overview);
  for(const id of this.selectedScenes())this.addCard(this.related(id));
  this.sceneChooser.set(false);this.notice.set('Added overview + '+this.selectedScenes().length+' explicitly selected scenes. Other linked material was not added.');
 }
 move(item: StudyItem, offset: number) {
  const items=[...this.current().items],i=items.findIndex(v=>v.id===item.id),j=i+offset;
  if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];this.updateSession({items});
 }
 remove(item: StudyItem) {
  const before=this.current(),index=before.items.findIndex(i=>i.id===item.id),items=before.items.filter(i=>i.id!==item.id);
  this.updateSession({items,selectedId:before.selectedId===item.id?(items[Math.min(index,items.length-1)]?.id??null):before.selectedId});
  if(!items.length){this.inspectingPrepared.set(false);this.mode.set('prepare');this.library.set(true);}
  if(before.selectedId===item.id)this.resetReader();
  this.notice.set('Removed '+item.card.title+' from this session.');
 }
 related(id: string) {return this.cards.find(c=>c.id===id)!;}
 capturedRelated(id: string) {return this.current().items.find(item=>item.sourceId===id&&!item.section);}
 followRelated(id: string) {
  if(this.frozen()) {
   const item=this.capturedRelated(id);if(item)this.selectItem(item);
   else this.notice.set('Not captured in this session. Return to the library to add it explicitly.');
  }else this.choose(this.related(id));
 }
 editNote(value: string) {
  const id=this.currentItem()?.id;if(!this.frozen()||!id)return;
  this.updateSession({items:this.current().items.map(item=>item.id===id?{...item,notes:value}:item)});
 }
 filterPrepared(query: string) {this.preparedQuery.set(query);if(!query.trim())this.revealSelectedItem();}
 revealSelectedItem() {setTimeout(()=>document.querySelector('.item-choice[aria-current="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'}));}
 resetReader() {this.focused.set(null);this.expanded.set([]);this.sceneChooser.set(false);this.jumpTop();}
 rememberSourceScroll() {this.sourceScroll=document.querySelector('.reader')?.scrollTop??0;}
 restoreSourceScroll() {setTimeout(()=>document.querySelector('.reader')?.scrollTo({top:this.sourceScroll}));}
 jumpTop() {setTimeout(()=>document.querySelector('.reader')?.scrollTo({top:0}));}
 opened(s: StudySection) {return this.full()||!s.background||this.expanded().includes(s.title);}
 toggle(s: StudySection) {const wasOpen=this.opened(s);this.full.set(false);this.expanded.update(a=>wasOpen?a.filter(t=>t!==s.title):[...a,s.title]);}
 jump(title: string) {
  this.focused.set(null);this.expanded.update(a=>[...a,title]);
  setTimeout(()=>{const el=document.getElementById('section-'+this.selected().sections.findIndex(s=>s.title===title));el?.scrollIntoView({block:'start'});el?.focus({preventScroll:true});});
 }
 revealMatch() {
  const q=this.query().trim().toLowerCase();if(!q)return;
  const s=this.selected().sections.find(s=>[s.title,...s.paragraphs].join(' ').toLowerCase().includes(q));
  if(s){this.jump(s.title);this.notice.set('Match revealed in '+s.title);}else this.notice.set('Match is in the card title or summary.');
 }
 searchAll() {this.category.set('All content');this.tag.set('');}
 layout(variant: string) {void this.router.navigate([],{queryParams:{variant},queryParamsHandling:'merge',replaceUrl:true});}
 cycle(offset: number) {const keys=['A','B'];this.layout(keys[(keys.indexOf(this.variant())+offset+2)%2]);}
 @HostListener('window:keydown',['$event']) key(e: KeyboardEvent) {
  if((e.target as HTMLElement).closest('input,textarea,select,button,summary,[contenteditable]')||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.cycle(e.key==='ArrowRight'?1:-1);}
 }
}

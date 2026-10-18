import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CAMPAIGN_REVIEW_CARDS } from './reader-campaign-fixtures';
import { READER_CARDS, StudyCard, StudySection } from './reader-fixtures';

// Disposable A/B review on /?prototype=preparation&study=reader&variant=A|B.
@Component({selector:'reader-study', imports:[FormsModule], templateUrl:'./reader-study.html', styleUrl:'./reader-study.css'})
export class ReaderStudy {
 readonly cards = [...CAMPAIGN_REVIEW_CARDS, ...READER_CARDS];
 readonly campaignExamples = signal(true);
 readonly selectedScenes = signal<string[]>([]);
 private route = inject(ActivatedRoute); private router = inject(Router);
 private params = toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 readonly variant = computed(() => {const v=this.params().get('variant'); return v==='B'?'B':'A';});
 readonly names = {A:'Library desk',B:'Source folio',C:'Outline and library drawer'};
 readonly selected = signal(this.cards[0]); readonly category = signal('Play library'); readonly query = signal(''); readonly tag = signal('');
 readonly categories = ['Play library','Scene','NPC','Adventure','Guidance','Issues / unclassified'];
 readonly library = signal(true); readonly notesOpen = signal(true); readonly outline = signal(true); readonly full = signal(false);
 readonly expanded = signal<string[]>([]); readonly focused = signal<string|null>(null); readonly notice = signal('');
 readonly notes = signal<Record<string,string>>({hall:'Ask who is holding the lever before resolving the sluice.'});
 readonly prepared = signal<string[]>([]); readonly sceneChooser = signal(false);
 readonly results = computed(() => this.cards.filter(c => c.id.startsWith('sw-')===this.campaignExamples() && this.inCategory(c) && (!this.tag()||c.tags.includes(this.tag())) && this.matches(c)));
 readonly wordCount = computed(() => this.selected().sections.map(s=>s.paragraphs.join(' ')).join(' ').split(/\s+/).length);
 inCategory(c: StudyCard) { const cat=this.category(); return cat==='All content'||(cat==='Play library'?c.purpose==='play':cat==='Issues / unclassified'?!!c.issue:c.type===cat); }
 matches(c:StudyCard) {return [c.title,c.summary,...c.sections.flatMap(s=>[s.title,...s.paragraphs])].join(' ').toLowerCase().includes(this.query().trim().toLowerCase());}
 choose(c:StudyCard) {this.selected.set(c);this.focused.set(null);this.sceneChooser.set(false);this.notice.set(''); if(this.query().trim()) this.revealMatch(); else this.jumpTop();}
 jumpTop(){setTimeout(()=>document.getElementById('reader-title')?.scrollIntoView({block:'start'}));}
 opened(s:StudySection){return this.full()||!s.background||this.expanded().includes(s.title);}
 toggle(s:StudySection){const wasOpen=this.opened(s);this.full.set(false);this.expanded.update(a=>wasOpen?a.filter(t=>t!==s.title):[...a,s.title]);}
 jump(title:string){this.focused.set(null);this.expanded.update(a=>[...a,title]);setTimeout(()=>{const el=document.getElementById('section-'+this.selected().sections.findIndex(s=>s.title===title));el?.scrollIntoView({block:'start'});el?.focus({preventScroll:true});});}
 revealMatch(){const q=this.query().trim().toLowerCase();if(!q)return;const s=this.selected().sections.find(s=>[s.title,...s.paragraphs].join(' ').toLowerCase().includes(q));if(s){this.jump(s.title);this.notice.set('Match revealed in '+s.title);}else this.notice.set('Match is in the card title or summary.');}
 searchAll(){this.category.set('All content');this.tag.set('');}
 add(title:string){this.prepared.update(a=>[...a,title]);this.notice.set('Sample capture added: '+title+' · memory only');}
 addDocument(){if(this.selected().type==='Adventure'){this.selectedScenes.set([]);this.sceneChooser.set(true);}else this.add(this.selected().title);}
 sceneOptions(){return (this.selected().sceneIds??['hall']).map(id=>this.related(id));}
 toggleScene(id:string){this.selectedScenes.update(a=>a.includes(id)?a.filter(v=>v!==id):[...a,id]);}
 captureAdventure(){this.add(this.selected().title);for(const id of this.selectedScenes())this.add(this.related(id).title);this.sceneChooser.set(false);}
 switchExamples(campaign:boolean){this.campaignExamples.set(campaign);this.category.set('Play library');this.query.set('');this.tag.set('');this.choose(campaign?CAMPAIGN_REVIEW_CARDS[0]:READER_CARDS[0]);}

 related(id:string){return this.cards.find(c=>c.id===id)!;}
 editNote(value:string){this.notes.update(n=>({...n,[this.selected().id]:value}));}
 cycle(offset:number){const keys=['A','B'];void this.router.navigate([],{queryParams:{variant:keys[(keys.indexOf(this.variant())+offset+2)%2]},queryParamsHandling:'merge',replaceUrl:true});}
 @HostListener('window:keydown',['$event']) key(e:KeyboardEvent){if((e.target as HTMLElement).closest('input,textarea,select,button,summary,[contenteditable]')||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.cycle(e.key==='ArrowRight'?1:-1);}}
}

import { SemanticMemory } from './semantic-memory/semantic-memory';
import { DocumentMemory } from './document-memory/document-memory';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ResearchApiService, ResearchHit, ResearchNote } from '../../../core/services/research-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector:'app-research-memory', standalone:true,
  imports: [TranslatePipe, DocumentMemory, SemanticMemory],
  templateUrl:'./research-memory.html', styleUrl:'./research-memory.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class ResearchMemory {
  readonly api=inject(ResearchApiService);
  readonly query=signal('');
  readonly language=signal<'pl'|'en'>('pl');
  readonly results=signal<ResearchHit[]>([]);
  readonly noteTitle=signal('');
  readonly noteContent=signal('');
  readonly memoryQuery=signal('');
  readonly matches=signal<ResearchNote[]>([]);
  readonly searchedMemory=signal(false);
  readonly notes=signal<ResearchNote[]>([]);
  readonly busy=signal(false);
  readonly info=signal('');
  readonly error=signal('');
  private async run(action:()=>Promise<void>):Promise<void> {
    if(this.busy()) return;
    this.busy.set(true); this.error.set(''); this.info.set('');
    try {await action();}
    catch(e) {this.error.set(e instanceof Error?e.message:'lab.research.operationError');}
    finally {this.busy.set(false);}
  }
  async search():Promise<void> {return this.run(async()=>{
    this.results.set(await this.api.search(this.query().trim(),this.language()));
    if(!this.results().length) this.info.set('lab.research.noResults');
  });}
  async refresh():Promise<void> {return this.run(async()=>{this.notes.set(await this.api.list());});}
  async saveLocal():Promise<void> {return this.run(async()=>{
    const saved=await this.api.saveLocal(this.noteTitle().trim(),this.noteContent().trim());
    this.notes.update(items=>[saved,...items]);
    this.noteTitle.set(''); this.noteContent.set('');
    this.info.set('memory.local.saved');
  });}
  async findLocal():Promise<void> {return this.run(async()=>{
    const found=await this.api.matches(this.memoryQuery().trim());
    this.matches.set(found);
    this.searchedMemory.set(true);
  });}
  async approve(hit:ResearchHit):Promise<void> {return this.run(async()=>{
    await this.api.save(hit.title,hit.language);
    this.notes.set(await this.api.list());
    this.info.set('lab.research.saved');
  });}
  async openSource(url:string):Promise<void> { try { await this.api.openSource(url); } catch(e) { this.error.set(e instanceof Error?e.message:'lab.research.openError'); } }
  async remove(note:ResearchNote):Promise<void> {return this.run(async()=>{
    await this.api.remove(note.id);
    this.notes.set(this.notes().filter(n=>n.id!==note.id));
    this.matches.set(this.matches().filter(n=>n.id!==note.id));
    this.info.set('lab.research.removed');
  });}
}

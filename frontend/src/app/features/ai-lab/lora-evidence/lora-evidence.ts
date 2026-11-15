import { ChangeDetectionStrategy,Component,inject,signal } from '@angular/core';
import { LoraEvidenceApi,LoraEvidence,LoraDataset } from '../../../core/services/lora-evidence';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
@Component({selector:'app-lora-evidence',standalone:true,imports:[TranslatePipe],
 templateUrl:'./lora-evidence.html',styleUrl:'./lora-evidence.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class LoraEvidencePanel {
 private readonly api=inject(LoraEvidenceApi);
 readonly query=signal('');readonly items=signal<LoraEvidence[]>([]);
 readonly dataset=signal<LoraDataset|null>(null);readonly busy=signal(false);readonly error=signal('');
 readonly instruction=signal<Record<string,string>>({});readonly response=signal<Record<string,string>>({});
 async ngOnInit(){ await this.reload(); }
 async reload(){try{const rows=await this.api.list();this.items.set(rows);
   this.instruction.set(Object.fromEntries(rows.map(x=>[x.id,x.instruction??''])));
   this.response.set(Object.fromEntries(rows.map(x=>[x.id,x.response??''])));
 }catch{this.error.set('lab.web.failed');}}
 async search(){if(this.busy() || !this.query().trim())return;this.busy.set(true);this.error.set('');
   try{await this.api.search(this.query().trim());await this.reload();}catch{this.error.set('lab.web.searchError');}
   finally{this.busy.set(false);}}
 setInstruction(id:string,v:string){this.instruction.update(x=>({...x,[id]:v}));}
 setResponse(id:string,v:string){this.response.update(x=>({...x,[id]:v}));}
 async review(id:string,approved:boolean){if(this.busy())return;this.busy.set(true);this.error.set('');
   try{await this.api.review(id,this.instruction()[id]??'',this.response()[id]??'',approved);await this.reload();this.dataset.set(null);}
   catch{this.error.set('lab.web.reviewError');}finally{this.busy.set(false);}}
 async export(){if(this.busy())return;this.busy.set(true);this.error.set('');
   try{this.dataset.set(await this.api.export());}catch{this.error.set('lab.web.exportError');}
   finally{this.busy.set(false);}}
}

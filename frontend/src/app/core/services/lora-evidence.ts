import { Injectable } from '@angular/core';
import { browserApi } from './browser-api';
export interface LoraEvidence { id:string; query:string; title:string; url:string; excerpt:string; instruction:string|null; response:string|null; approved:boolean; }
export interface LoraDataset { id:string; examples:number; path:string; }
@Injectable({providedIn:'root'})
export class LoraEvidenceApi {
 list(): Promise<LoraEvidence[]> {return browserApi<LoraEvidence[]>('GET','/api/ai-lab/lora/evidence');}
 search(query:string): Promise<LoraEvidence[]> {return browserApi<LoraEvidence[]>('POST','/api/ai-lab/lora/evidence/search',{query});}
 review(id:string,instruction:string,response:string,approved:boolean): Promise<LoraEvidence> {
   return browserApi<LoraEvidence>('PATCH',`/api/ai-lab/lora/evidence/${id}`,{instruction,response,approved});
 }
 export(): Promise<LoraDataset> {return browserApi<LoraDataset>('POST','/api/ai-lab/lora/evidence/export',{});}
}

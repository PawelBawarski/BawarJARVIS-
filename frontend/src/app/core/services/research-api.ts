import { browserApi } from './browser-api';
import { Injectable } from '@angular/core';

export type ResearchRequest =
  | {operation:'list'}
  | {operation:'search'; query:string; language:'pl'|'en'}
  | {operation:'save'; title:string; language:'pl'|'en'}
  | {operation:'delete'; id:string};
export interface ResearchHit { readonly title:string; readonly excerpt:string; readonly url:string; readonly language:'pl'|'en'; }
export interface ResearchNote { readonly id:string; readonly title:string; readonly url:string; readonly excerpt:string; }
type Result = {ok:true;data:unknown}|{ok:false;error:string;status:number};
type BridgeWindow = Window & {jarvisDesktop?: {researchApi?: (request:ResearchRequest)=>Promise<Result>; openResearchSource?: (url:string)=>Promise<boolean>}};
@Injectable({providedIn:'root'})
export class ResearchApiService {
  get available(): boolean { return true; }
  private async request<T>(query:ResearchRequest):Promise<T> {
    const bridge=(window as BridgeWindow).jarvisDesktop?.researchApi;
    if (!bridge) {
      const base = '/api/research';
      switch (query.operation) {
        case 'list': return browserApi<T>('GET', base);
        case 'search': return browserApi<T>('POST', `${base}/search`, { query: query.query, language: query.language });
        case 'save': return browserApi<T>('POST', `${base}/save`, { title: query.title, language: query.language });
        case 'delete': return browserApi<T>('DELETE', `${base}/${encodeURIComponent(query.id)}`);
      }
    }
    const result=await bridge(query);
    if (!result.ok) throw new Error('Błąd badań internetu: '+result.error);
    return result.data as T;
  }
  // Web-first personal notes: explicit writes only, never Electron IPC.
  saveLocal(title:string,content:string):Promise<ResearchNote> {
    return browserApi<ResearchNote>('POST','/api/research/notes',{title,content});
  }
  matches(query:string):Promise<ResearchNote[]> {
    return browserApi<ResearchNote[]>('GET',`/api/research/matches?q=${encodeURIComponent(query)}`);
  }
  async openSource(url:string):Promise<void> {
    const open=(window as BridgeWindow).jarvisDesktop?.openResearchSource;
    if (!open) {
      const target = new URL(url);
      if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('INVALID_RESEARCH_URL');
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    await open(url);
  }
  search(query:string,language:'pl'|'en'):Promise<ResearchHit[]> {return this.request({operation:'search',query,language});}
  list():Promise<ResearchNote[]> {return this.request({operation:'list'});}
  save(title:string,language:'pl'|'en'):Promise<ResearchNote> {return this.request({operation:'save',title,language});}
  remove(id:string):Promise<void> {return this.request({operation:'delete',id});}
}

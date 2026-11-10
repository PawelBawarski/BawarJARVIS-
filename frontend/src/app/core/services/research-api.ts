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
  get available(): boolean { return typeof (window as BridgeWindow).jarvisDesktop?.researchApi === 'function'; }
  private async request<T>(query:ResearchRequest):Promise<T> {
    const bridge=(window as BridgeWindow).jarvisDesktop?.researchApi;
    if (!bridge) throw new Error('Funkcja wymaga aplikacji desktopowej Jarvis.');
    const result=await bridge(query);
    if (!result.ok) throw new Error('Błąd badań internetu: '+result.error);
    return result.data as T;
  }
  async openSource(url:string):Promise<void> {
    const open=(window as BridgeWindow).jarvisDesktop?.openResearchSource;
    if (!open) throw new Error('Otwieranie źródeł wymaga aplikacji desktopowej.');
    await open(url);
  }
  search(query:string,language:'pl'|'en'):Promise<ResearchHit[]> {return this.request({operation:'search',query,language});}
  list():Promise<ResearchNote[]> {return this.request({operation:'list'});}
  save(title:string,language:'pl'|'en'):Promise<ResearchNote> {return this.request({operation:'save',title,language});}
  remove(id:string):Promise<void> {return this.request({operation:'delete',id});}
}

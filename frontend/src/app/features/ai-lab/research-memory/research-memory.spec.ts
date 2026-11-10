import { TestBed } from '@angular/core/testing';
import { describe,expect,it,vi } from 'vitest';
import { ResearchApiService } from '../../../core/services/research-api';
import { ResearchMemory } from './research-memory';
describe('ResearchMemory',()=>{
  it('searches and saves only after explicit approval',async()=>{
    const hit={title:'Angular',excerpt:'Framework',url:'https://pl.wikipedia.org/wiki/Angular',language:'pl'};
    const api={search:vi.fn().mockResolvedValue([hit]),save:vi.fn().mockResolvedValue({id:'one',...hit}),list:vi.fn().mockResolvedValue([{id:'one',...hit}]),remove:vi.fn()};
    await TestBed.configureTestingModule({imports:[ResearchMemory],providers:[{provide:ResearchApiService,useValue:api}]}).compileComponents();
    const f=TestBed.createComponent(ResearchMemory);
    f.componentInstance.query.set('Angular');
    await f.componentInstance.search();
    f.detectChanges();
    expect(api.save).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('[data-testid="research-results"]')).not.toBeNull();
    await f.componentInstance.approve(hit as any);
    f.detectChanges();
    expect(api.save).toHaveBeenCalledWith('Angular','pl');
    expect(f.nativeElement.querySelector('[data-testid="research-notes"]')).not.toBeNull();
  });
});

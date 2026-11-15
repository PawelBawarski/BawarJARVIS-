import { TestBed } from '@angular/core/testing';
import { describe,it,expect,vi } from 'vitest';
import { LoraEvidencePanel } from './lora-evidence';
import { LoraEvidenceApi } from '../../../core/services/lora-evidence';
import { TranslationService } from '../../../core/services/translation';
describe('LoraEvidencePanel',()=>{
 it('does not search without a query or automatically approve sources',async()=>{
  const api={list:vi.fn().mockResolvedValue([]),search:vi.fn(),review:vi.fn(),export:vi.fn()};
  TestBed.configureTestingModule({providers:[{provide:LoraEvidenceApi,useValue:api},{provide:TranslationService,useValue:{translate:(k:string)=>k}}]});
  const f=TestBed.createComponent(LoraEvidencePanel);f.detectChanges();await f.componentInstance.search();
  expect(api.search).not.toHaveBeenCalled();expect(api.review).not.toHaveBeenCalled();f.destroy();
 });
});

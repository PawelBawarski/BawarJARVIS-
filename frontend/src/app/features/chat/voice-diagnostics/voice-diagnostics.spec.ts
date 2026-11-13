import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceDiagnostics } from './voice-diagnostics';
import { VoicePipelineDiagnostics } from '../../../core/services/voice-pipeline-diagnostics';
import { TranslationService } from '../../../core/services/translation';

describe('21.4 diagnostics button — user initiated status GETs only', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts collapsed and checks local engines only after a click', async () => {
    const health = {
      checking: signal(false), checked: signal(false),
      whisper: signal('unknown'), qwen: signal('unknown'),
      piperPl: signal('unknown'), piperEn: signal('unknown'),
      refresh: vi.fn(async () => {
        health.checked.set(true);
        health.whisper.set('ready');
        health.qwen.set('ready');
        health.piperPl.set('ready');
        health.piperEn.set('offline');
      }),
    };
    await TestBed.configureTestingModule({
      imports: [VoiceDiagnostics],
      providers: [
        { provide: VoicePipelineDiagnostics, useValue: health },
        { provide: TranslationService, useValue: {
          translate: (key: string) => key, dictionaryVersion: signal(0),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(VoiceDiagnostics);
    fixture.detectChanges();
    expect(health.refresh).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="voice-health-results"]')).toBeNull();
    fixture.nativeElement.querySelector('[data-testid="voice-health-refresh"]').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(health.refresh).toHaveBeenCalledOnce();
    const result = fixture.nativeElement.querySelector('[data-testid="voice-health-results"]') as HTMLElement;
    expect(result).not.toBeNull();
    expect(result.querySelectorAll('[data-health="ready"]')).toHaveLength(3);
  });
});

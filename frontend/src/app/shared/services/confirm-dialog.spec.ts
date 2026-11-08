import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { ConfirmDialogService } from './confirm-dialog';

describe('ConfirmDialogService', () => {
  const options = {
    title: 'Usunąć rozmowę?',
    message: 'Nie można cofnąć tej operacji.',
    confirmText: 'Usuń',
    cancelText: 'Anuluj',
  };

  it('should return true after confirmation', async () => {
    const open = vi.fn().mockReturnValue({
      closed: of(true),
    });

    TestBed.configureTestingModule({
      providers: [{ provide: Dialog, useValue: { open } }],
    });

    const service = TestBed.inject(ConfirmDialogService);

    expect(await service.open(options)).toBe(true);
    expect(open).toHaveBeenCalledOnce();
  });

  it('should return false after cancellation', async () => {
    const open = vi.fn().mockReturnValue({
      closed: of(false),
    });

    TestBed.configureTestingModule({
      providers: [{ provide: Dialog, useValue: { open } }],
    });

    const service = TestBed.inject(ConfirmDialogService);

    expect(await service.open(options)).toBe(false);
  });
});

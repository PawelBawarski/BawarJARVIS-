import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog';
import { ConfirmOptions } from '../../services/confirm-dialog';

describe('ConfirmDialog', () => {
  const closeMock = vi.fn();

  const dialogData: ConfirmOptions = {
    title: 'Usunąć rozmowę?',
    message: 'Tej operacji nie można cofnąć.',
    confirmText: 'Usuń rozmowę',
    cancelText: 'Anuluj',
  };

  beforeEach(async () => {
    closeMock.mockReset();

    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: dialogData,
        },
        {
          provide: DialogRef,
          useValue: {
            close: closeMock,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create dialog', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display title and message', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.confirm-dialog__title')?.textContent).toContain(
      'Usunąć rozmowę?',
    );

    expect(element.querySelector('.confirm-dialog__description')?.textContent).toContain(
      'Tej operacji nie można cofnąć.',
    );
  });

  it('should close with true after confirmation', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.confirm-dialog__confirm',
    );

    button.click();

    expect(closeMock).toHaveBeenCalledWith(true);
  });

  it('should close with false after cancellation', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.confirm-dialog__cancel');

    button.click();

    expect(closeMock).toHaveBeenCalledWith(false);
  });
});

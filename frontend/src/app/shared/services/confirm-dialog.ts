import { inject, Injectable } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';

import { ConfirmDialog } from '../ui/confirm-dialog/confirm-dialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private readonly dialog = inject(Dialog);

  async open(options: ConfirmOptions): Promise<boolean> {
    const dialogRef = this.dialog.open<boolean, ConfirmOptions>(ConfirmDialog, {
      data: options,
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
      hasBackdrop: true,
      disableClose: false,
      role: 'alertdialog',
      ariaLabel: options.title,
    });

    const result = await firstValueFrom(dialogRef.closed, { defaultValue: false });

    return result === true;
  }
}

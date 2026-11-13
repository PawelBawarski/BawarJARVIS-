import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { ResearchDocument, ResearchDocumentApi } from '../../../../core/services/research-document-api';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

const documentErrors: Record<string, string> = {
  MEMORY_DOC_ALREADY_IMPORTED: 'memory.documents.duplicate',
  MEMORY_DOC_TEXT_EMPTY: 'memory.documents.noText',
  MEMORY_DOC_INVALID_PDF: 'memory.documents.invalidPdf',
  MEMORY_DOC_PDF_RESTRICTED: 'memory.documents.pdfRestricted',
  MEMORY_DOC_INVALID_UTF8: 'memory.documents.invalidUtf8',
  MEMORY_DOC_TEXT_TOO_LARGE: 'memory.documents.textTooLarge',
  MEMORY_DOC_TOO_MANY_CHUNKS: 'memory.documents.textTooLarge',
  MEMORY_DOC_FILE_SIZE: 'memory.documents.invalidFile',
};

@Component({
  selector: 'app-research-document-memory',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './document-memory.html',
  styleUrl: './document-memory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentMemory {
  private readonly api = inject(ResearchDocumentApi);
  @ViewChild('documentFile') fileInput?: ElementRef<HTMLInputElement>;
  readonly selectedFile = signal<File | null>(null);
  readonly documents = signal<ResearchDocument[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly loaded = signal(false);
  readonly pendingDelete = signal<string | null>(null);

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.error.set('');
    this.info.set('');
    if (file && (file.size > 3 * 1024 * 1024 || !/\.(pdf|txt|md)$/i.test(file.name))) {
      this.selectedFile.set(null);
      this.error.set('memory.documents.invalidFile');
      input.value = '';
      return;
    }
    this.selectedFile.set(file);
  }

  private async run(task: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    try { await task(); }
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      this.error.set(documentErrors[code] ?? 'memory.documents.requestError');
    }
    finally { this.busy.set(false); }
  }

  async refresh(): Promise<void> {
    return this.run(async () => {
      this.documents.set(await this.api.list());
      this.loaded.set(true);
    });
  }

  async importSelected(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.busy()) return;
    return this.run(async () => {
      const saved = await this.api.importFile(file);
      this.documents.update(items => [saved, ...items.filter(item => item.id !== saved.id)]);
      this.loaded.set(true);
      this.selectedFile.set(null);
      if (this.fileInput) this.fileInput.nativeElement.value = '';
      this.info.set('memory.documents.saved');
    });
  }

  requestDelete(id: string): void { this.pendingDelete.set(id); }
  cancelDelete(): void { this.pendingDelete.set(null); }

  async confirmDelete(id: string): Promise<void> {
    if (this.pendingDelete() !== id || this.busy()) return;
    return this.run(async () => {
      await this.api.remove(id);
      this.documents.update(items => items.filter(item => item.id !== id));
      this.pendingDelete.set(null);
      this.info.set('memory.documents.deleted');
    });
  }
}

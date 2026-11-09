import { Component, OnInit, inject, signal } from '@angular/core';
import {
  WorkspaceApiService, WorkspaceEntry, WorkspaceListing,
  WorkspacePreview, WorkspaceStatus,
} from '../../../core/services/workspace-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-workspace',
  imports: [TranslatePipe],
  templateUrl: './workspace-panel.html',
  styleUrl: './workspace-panel.scss',
})
export class AiLabWorkspacePanel implements OnInit {
  private readonly api = inject(WorkspaceApiService);
  readonly connected = this.api.available;
  readonly workspace = signal<WorkspaceStatus | null>(null);
  readonly listing = signal<WorkspaceListing | null>(null);
  readonly preview = signal<WorkspacePreview | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit(): void { void this.refresh(); }

  async refresh(): Promise<void> {
    if (!this.api.available) { this.error.set('WORKSPACE_REQUIRES_ELECTRON'); return; }
    await this.perform(async () => {
      const status = await this.api.status();
      this.workspace.set(status);
      if (status.selected) this.listing.set(await this.api.list(''));
      else this.listing.set(null);
      this.preview.set(null);
    });
  }
  async choose(): Promise<void> {
    await this.perform(async () => {
      const status = await this.api.choose();
      this.workspace.set(status);
      this.listing.set(status.selected ? await this.api.list('') : null);
      this.preview.set(null);
    });
  }
  async clear(): Promise<void> {
    await this.perform(async () => {
      this.workspace.set(await this.api.clear());
      this.listing.set(null);
      this.preview.set(null);
    });
  }
  async open(entry: WorkspaceEntry): Promise<void> {
    if (entry.kind === 'directory') {
      await this.perform(async () => {
        this.listing.set(await this.api.list(entry.relativePath));
        this.preview.set(null);
      });
      return;
    }
    await this.perform(async () => { this.preview.set(await this.api.read(entry.relativePath)); });
  }
  async back(): Promise<void> {
    const current = this.listing()?.relativePath ?? '';
    if (!current) return;
    const parent = current.includes('/') ? current.slice(0, current.lastIndexOf('/')) : '';
    await this.perform(async () => {
      this.listing.set(await this.api.list(parent));
      this.preview.set(null);
    });
  }
  private async perform(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try { await action(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'WORKSPACE_ERROR'); }
    finally { this.busy.set(false); }
  }
}

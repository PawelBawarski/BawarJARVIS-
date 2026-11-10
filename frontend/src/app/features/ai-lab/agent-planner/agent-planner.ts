import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AgentCodeSource, AgentProposal, AgentProposalApiService } from '../../../core/services/agent-proposal-api';
import { WorkspaceApiService, WorkspaceEntry, WorkspaceListing, WorkspacePreview } from '../../../core/services/workspace-api';

@Component({
  selector: 'app-agent-planner',
  standalone: true,
  imports: [],
  templateUrl: './agent-planner.html',
  styleUrl: './agent-planner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentPlanner implements OnInit {
  readonly api = inject(AgentProposalApiService);
  readonly workspaceApi = inject(WorkspaceApiService);
  readonly workspaceRoot = signal<string | null>(null);
  readonly workspaceListing = signal<WorkspaceListing | null>(null);
  readonly workspacePreview = signal<WorkspacePreview | null>(null);
  readonly sources = signal<AgentCodeSource[]>([]);
  readonly contextBusy = signal(false);
  readonly contextError = signal('');
  readonly MAX_EXCERPT = 3600;
  readonly MAX_TOTAL = 8000;
  readonly task = signal('');
  readonly feedback = signal('');
  readonly proposals = signal<AgentProposal[]>([]);
  readonly selected = signal<AgentProposal | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  ngOnInit(): void {
    if (this.api.available) void this.refresh();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    try { await action(); }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Błąd operacji agenta.');
    } finally {
      this.busy.set(false);
    }
  }

  async refresh(): Promise<void> {
    return this.run(async () => {
      const items = await this.api.list();
      this.proposals.set(items);
      const id = this.selected()?.id;
      this.selected.set(items.find(item => item.id === id) ?? items[0] ?? null);
    });
  }

  async generate(): Promise<void> {
    const text = this.task().trim();
    if (!text || text.length > 1200) return;
    return this.run(async () => {
      const files = this.sources();
      const created = files.length ? await this.api.generate(text, files) : await this.api.generate(text);
      this.proposals.update(all => [created, ...all]);
      this.selected.set(created);
      this.task.set('');
      this.info.set(files.length ? `Qwen przeanalizował ${files.length} zatwierdzonych fragmentów i przygotował plan.` : 'Qwen przygotował propozycję. Przejrzyj ją przed decyzją.');
    });
  }

  /** Existing Electron workspace bridge is strictly read-only. Nothing is read automatically. */
  private async withWorkspace(action: () => Promise<void>): Promise<void> {
    if (this.contextBusy() || this.busy()) return;
    this.contextBusy.set(true);
    this.contextError.set('');
    try { await action(); }
    catch (error) { this.contextError.set(error instanceof Error ? error.message : 'Nie udało się odczytać katalogu.'); }
    finally { this.contextBusy.set(false); }
  }

  async chooseWorkspace(): Promise<void> {
    return this.withWorkspace(async () => {
      const old = this.workspaceRoot();
      const status = await this.workspaceApi.choose();
      this.workspaceRoot.set(status.selected);
      if (old !== status.selected) this.sources.set([]);
      this.workspacePreview.set(null);
      this.workspaceListing.set(status.selected ? await this.workspaceApi.list('') : null);
    });
  }

  async loadWorkspace(): Promise<void> {
    return this.withWorkspace(async () => {
      const old = this.workspaceRoot();
      const status = await this.workspaceApi.status();
      this.workspaceRoot.set(status.selected);
      if (old !== status.selected) this.sources.set([]);
      this.workspacePreview.set(null);
      this.workspaceListing.set(status.selected ? await this.workspaceApi.list('') : null);
    });
  }

  async openWorkspaceEntry(entry: WorkspaceEntry): Promise<void> {
    return this.withWorkspace(async () => {
      if (entry.kind === 'directory') {
        this.workspaceListing.set(await this.workspaceApi.list(entry.relativePath));
        this.workspacePreview.set(null);
      } else {
        this.workspacePreview.set(await this.workspaceApi.read(entry.relativePath));
      }
    });
  }

  async goWorkspaceBack(): Promise<void> {
    const location = this.workspaceListing()?.relativePath ?? '';
    if (!location) return;
    const parent = location.includes('/') ? location.substring(0, location.lastIndexOf('/')) : '';
    return this.withWorkspace(async () => {
      this.workspaceListing.set(await this.workspaceApi.list(parent));
      this.workspacePreview.set(null);
    });
  }

  attachPreview(): void {
    const preview = this.workspacePreview();
    if (!preview || this.contextBusy()) return;
    const excerpt = preview.content.slice(0, this.MAX_EXCERPT);
    if (!excerpt.trim()) { this.contextError.set('Wybrany plik jest pusty.'); return; }
    const previous = this.sources().filter(item => item.relativePath !== preview.relativePath);
    if (previous.length >= 3 || previous.reduce((a, b) => a + b.content.length, excerpt.length) > this.MAX_TOTAL) {
      this.contextError.set('Limit: 3 pliki, 3600 znaków na plik, 8000 znaków łącznie.');
      return;
    }
    this.sources.set([...previous, { relativePath: preview.relativePath, content: excerpt }]);
    this.contextError.set('');
  }

  removeSource(relativePath: string): void {
    this.sources.update(items => items.filter(item => item.relativePath !== relativePath));
  }

  async approve(): Promise<void> { return this.review('APPROVED'); }
  async reject(): Promise<void> { return this.review('REJECTED'); }

  private async review(decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    const selected = this.selected();
    if (!selected || selected.status !== 'PENDING') return;
    return this.run(async () => {
      const updated = decision === 'APPROVED'
        ? await this.api.approve(selected.id)
        : await this.api.reject(selected.id);
      this.replace(updated);
      this.info.set(decision === 'APPROVED'
        ? 'Plan zaakceptowany do dalszych prac. Nie wykonano żadnych zmian plików.'
        : 'Propozycja odrzucona. Nie wykonano zmian plików.');
    });
  }

  async revise(): Promise<void> {
    const selected = this.selected();
    const comments = this.feedback().trim();
    if (!selected || selected.status !== 'PENDING' || !comments || comments.length > 1200) return;
    return this.run(async () => {
      const updated = await this.api.revise(selected.id, comments);
      this.replace(updated);
      this.feedback.set('');
      this.info.set('Qwen poprawił plan. Wymaga on Twojej ponownej oceny.');
    });
  }

  choose(item: AgentProposal): void {
    if (!this.busy()) { this.selected.set(item); this.error.set(''); this.info.set(''); }
  }

  statusLabel(status: string): string {
    if (status === 'PENDING') return 'Do oceny';
    if (status === 'APPROVED') return 'Zaakceptowany plan';
    return 'Odrzucony plan';
  }

  private replace(updated: AgentProposal): void {
    this.proposals.update(all => all.map(item => item.id === updated.id ? updated : item));
    this.selected.set(updated);
  }
}

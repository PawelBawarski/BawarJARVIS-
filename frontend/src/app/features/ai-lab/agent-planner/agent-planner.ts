import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AgentCodeSource, AgentPatchPreview, AgentProposal, AgentProposalApiService } from '../../../core/services/agent-proposal-api';
import { WorkspaceApiService, WorkspaceEntry, WorkspaceListing, WorkspacePreview } from '../../../core/services/workspace-api';
import { isAllowedCodePath } from './source-validation';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { BrowserApiError, browserApiErrorKey } from '../../../core/services/browser-api';
import { AgentSandbox } from '../agent-sandbox/agent-sandbox'; // JARVIS_STAGE16_4_SANDBOX
import { AgentFileWrite } from '../agent-file-write/agent-file-write';
import { AgentChangeReview } from '../agent-change-review/agent-change-review';
import { checkedPatchPreview } from './patch-review-validation';

@Component({
  selector: 'app-agent-planner',
  standalone: true,
  imports: [AgentSandbox, AgentFileWrite, AgentChangeReview, TranslatePipe],
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
  readonly selectedDiffPath = signal('');
  readonly diffBusy = signal(false);
  readonly diffError = signal('');
  readonly diffPreview = signal<AgentPatchPreview | null>(null);
  private diffGeneration = 0;
  readonly diffSource = computed(() => this.sources().find(s => s.relativePath === this.selectedDiffPath()) ?? this.sources()[0] ?? null);
  readonly MAX_EXCERPT = 3600;
  readonly MAX_TOTAL = 8000;
  readonly sourceCharacterCount = computed(() => this.sources().reduce((total, source) => total + source.content.length, 0));
  readonly pendingReviewCount = computed(() => this.proposals().filter(item => item.status === 'PENDING').length);
  /** Browser-first: only manually pasted or explicitly selected code is reviewed. */
  readonly manualPath = signal('');
  readonly manualCode = signal('');
  readonly importBusy = signal(false);
  readonly task = signal('');
  readonly feedback = signal('');
  readonly proposals = signal<AgentProposal[]>([]);
  readonly selected = signal<AgentProposal | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  /** Describes UI work only; it does not claim the model or backend is healthy. */
  readonly operation = signal<'idle' | 'history' | 'generate' | 'review' | 'revise'>('idle');
  readonly workflowStep = computed<1 | 2 | 3>(() =>
    this.selected() ? 3 : (this.sources().length || this.task().trim() ? 2 : 1));
  readonly activityBusy = computed(() => this.busy() || this.diffBusy() || this.contextBusy() || this.importBusy());
  readonly activityKey = computed((): string => {
    if (this.importBusy() || this.contextBusy()) return 'lab.planner.activity.reading';
    if (this.diffBusy()) return 'lab.planner.activity.diff';
    if (this.busy()) {
      switch (this.operation()) {
        case 'generate': return 'lab.planner.activity.generating';
        case 'review': return 'lab.planner.activity.deciding';
        case 'revise': return 'lab.planner.activity.revising';
        default: return 'lab.planner.activity.history';
      }
    }
    if (this.error() || this.contextError() || this.diffError()) return 'lab.planner.activity.error';
    const proposal = this.selected();
    if (proposal?.status === 'PENDING') return 'lab.planner.activity.review';
    if (proposal?.status === 'APPROVED') return 'lab.planner.activity.approved';
    if (proposal?.status === 'REJECTED') return 'lab.planner.activity.rejected';
    if (this.diffPreview()) return 'lab.planner.activity.diffReady';
    if (this.sources().length) return 'lab.planner.activity.context';
    return 'lab.planner.activity.ready';
  });
  readonly nextActionKey = computed((): string => {
    if (this.activityBusy()) return 'lab.planner.next.wait';
    if (this.error() || this.contextError() || this.diffError()) return 'lab.planner.next.retry';
    if (this.diffPreview()) return 'lab.planner.next.diffReady';
    if (this.selected()?.status === 'PENDING') return 'lab.planner.next.review';
    if (this.selected()) return 'lab.planner.next.newTask';
    if (this.task().trim()) return 'lab.planner.next.generate';
    return 'lab.planner.next.describe';
  });

  ngOnInit(): void {
    if (this.api.available) void this.refresh();
  }

  private async run(action: () => Promise<void>, operation: 'history' | 'generate' | 'review' | 'revise' = 'history'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.operation.set(operation);
    this.error.set('');
    this.info.set('');
    try { await action(); }
    catch (error) {
      // Mutations must NOT be retried automatically: the backend may have committed them.
      this.error.set(operation !== 'history' && error instanceof BrowserApiError && error.status === 0
        ? 'api.error.actionUnconfirmed'
        : browserApiErrorKey(error) ?? (error instanceof Error ? error.message : 'api.error.general'));
    } finally {
      this.busy.set(false);
      this.operation.set('idle');
    }
  }

  async refresh(): Promise<void> {
    return this.run(async () => {
      const items = await this.api.list();
      this.proposals.set(items);
      const id = this.selected()?.id;
      this.selected.set(items.find(item => item.id === id) ?? items[0] ?? null);
    }, 'history');
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
      this.clearDiff();
      this.info.set(files.length ? `Qwen przeanalizował ${files.length} zatwierdzonych fragmentów i przygotował plan.` : 'Qwen przygotował propozycję. Przejrzyj ją przed decyzją.');
    }, 'generate');
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
      if (old !== status.selected) { this.sources.set([]); this.clearDiff(); }
      this.workspacePreview.set(null);
      this.workspaceListing.set(status.selected ? await this.workspaceApi.list('') : null);
    });
  }

  async loadWorkspace(): Promise<void> {
    return this.withWorkspace(async () => {
      const old = this.workspaceRoot();
      const status = await this.workspaceApi.status();
      this.workspaceRoot.set(status.selected);
      if (old !== status.selected) { this.sources.set([]); this.clearDiff(); }
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
    this.selectedDiffPath.set(preview.relativePath);
    this.clearDiff();
    this.contextError.set('');
  }

  /** A file selection populates a preview; it never sends content to the API. */
  async loadLocalCodeFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (!file || this.importBusy() || this.busy()) return;
    this.contextError.set('');
    if (!isAllowedCodePath(file.name)) {
      this.contextError.set('Niedozwolona nazwa pliku. Wybierz plik źródłowy bez sekretów.');
      return;
    }
    if (file.size > 16_384) {
      this.contextError.set('Plik jest za duży do podglądu (limit 16 KiB).');
      return;
    }
    this.importBusy.set(true);
    try {
      const code = await file.text();
      if (!code.trim() || code.length > this.MAX_EXCERPT || code.includes('\0')) {
        this.contextError.set('Fragment musi zawierać od 1 do 3600 znaków i nie może mieć bajtów NUL.');
        return;
      }
      this.manualPath.set(file.name);
      this.manualCode.set(code);
    } catch {
      this.contextError.set('Nie udało się odczytać wskazanego pliku.');
    } finally {
      this.importBusy.set(false);
    }
  }

  /** Explicit consent step shared by pasted code and browser-selected files. */
  attachManualSource(): void {
    if (this.busy() || this.contextBusy() || this.importBusy()) return;
    const relativePath = this.manualPath().trim();
    const content = this.manualCode();
    if (!isAllowedCodePath(relativePath)) {
      this.contextError.set('Podaj bezpieczną ścieżkę względną, np. frontend/src/app/demo.ts.');
      return;
    }
    if (!content.trim() || content.length > this.MAX_EXCERPT || content.includes('\0')) {
      this.contextError.set('Fragment musi zawierać od 1 do 3600 znaków i nie może mieć bajtów NUL.');
      return;
    }
    const previous = this.sources().filter(item => item.relativePath !== relativePath);
    if (previous.length >= 3 || previous.reduce((total, item) => total + item.content.length, content.length) > this.MAX_TOTAL) {
      this.contextError.set('Limit: 3 fragmenty, 3600 znaków każdy, 8000 znaków łącznie.');
      return;
    }
    this.sources.set([...previous, { relativePath, content }]);
    this.selectedDiffPath.set(relativePath);
    this.clearDiff();
    this.contextError.set('');
    this.manualCode.set('');
    this.manualPath.set('');
  }

  removeSource(relativePath: string): void {
    this.sources.update(items => items.filter(item => item.relativePath !== relativePath));
    this.clearDiff();
    if (this.selectedDiffPath() === relativePath) this.selectedDiffPath.set(this.sources()[0]?.relativePath ?? '');
  }

  /** Stage 16.3. Generates a temporary diff ONLY from user-approved source. No file writes. */
  async generateDiff(): Promise<void> {
    const source = this.diffSource();
    const goal = (this.task().trim() || this.selected()?.task || '').trim();
    if (!source || !goal || goal.length > 1200 || this.diffBusy() || this.busy()) return;
    const requestGeneration = ++this.diffGeneration;
    this.diffBusy.set(true);
    this.diffError.set('');
    this.diffPreview.set(null);
    try {
      const response = await this.api.previewPatch(goal, source);
      const preview = checkedPatchPreview(response, source);
      // Reject a response for another file and never show a preview for a removed source.
      if (requestGeneration !== this.diffGeneration ||
        (this.task().trim() || this.selected()?.task || '').trim() !== goal ||
        this.diffSource()?.relativePath !== source.relativePath ||
        preview.original !== source.content ||
        !this.sources().some(item => item.relativePath === source.relativePath && item.content === source.content)) {
        throw new Error('Niezgodny lub nieaktualny podgląd. Wybierz plik ponownie.');
      }
      this.diffPreview.set(preview);
    } catch (error) {
      this.diffError.set(browserApiErrorKey(error) ?? (error instanceof Error ? error.message : 'api.error.general'));
    } finally {
      this.diffBusy.set(false);
    }
  }

  selectDiffSource(relativePath: string): void {
    if (!this.sources().some(s => s.relativePath === relativePath)) return;
    this.selectedDiffPath.set(relativePath);
    this.clearDiff();
  }

  private clearDiff(): void {
    this.diffGeneration++;
    this.diffPreview.set(null);
    this.diffError.set('');
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
    }, 'review');
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
    }, 'revise');
  }

  choose(item: AgentProposal): void {
    if (!this.busy()) { this.selected.set(item); this.clearDiff(); this.error.set(''); this.info.set(''); }
  }

  updateTask(value: string): void {
    if (value === this.task()) return;
    this.task.set(value);
    this.clearDiff();
  }

  statusKey(status: string): string {
    if (status === 'PENDING') return 'lab.planner.status.pending';
    if (status === 'APPROVED') return 'lab.planner.status.approved';
    return 'lab.planner.status.rejected';
  }

  private replace(updated: AgentProposal): void {
    this.proposals.update(all => all.map(item => item.id === updated.id ? updated : item));
    this.selected.set(updated);
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ModuleHelpService } from '../../../core/services/module-help.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Source = { id: string; title: string; source: string; score: number };
type Knowledge = { id: string; title: string; source: string; origin: string };
type Preview = { previewId: string; title: string; source: string; preview: string; expiresInSeconds: number };
type Reply = { answer: string; confidence: number; sources: Source[]; steps?: { step: string; summary: string }[] };
type Status = { knowledgeDocuments: number; feedbackSamples: number; model: string; llmAvailable: boolean; gpuAccelerated: boolean };

/** AI Lab 13: standalone local Java service client; never stores the token. */
@Component({
  selector: 'app-learning-lab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './learning-lab.html',
  styleUrl: './learning-lab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningLab {
  readonly help = inject(ModuleHelpService);
  readonly token = signal('');
  readonly question = signal('');
  readonly title = signal('');
  readonly source = signal('');
  readonly content = signal('');
  readonly url = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly answer = signal('');
  readonly sources = signal<Source[]>([]);
  readonly steps = signal<{ step: string; summary: string }[]>([]);
  readonly documents = signal<Knowledge[]>([]);
  readonly status = signal<Status | null>(null);
  readonly preview = signal<Preview | null>(null);
  readonly feedbackDocument = signal('');
  readonly positive = signal(true);

  private readonly baseUrl = 'http://127.0.0.1:8766/api/ai';
  private async api<T>(path: string, body?: Record<string, string | boolean>): Promise<T> {
    if (!this.token().trim()) throw new Error('Wklej lokalny token wyświetlony przy uruchomieniu Javy.');
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'X-Jarvis-Token': this.token(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    try { await action(); }
    catch (error: unknown) { this.error.set(error instanceof Error ? error.message : 'Nieoczekiwany błąd'); }
    finally { this.busy.set(false); }
  }
  async refresh(): Promise<void> {
    return this.run(async () => {
      const [status, knowledge] = await Promise.all([
        this.api<Status>('/status'),
        this.api<{ documents: Knowledge[] }>('/knowledge'),
      ]);
      this.status.set(status);
      this.documents.set(knowledge.documents);
    });
  }
  async ask(): Promise<void> {
    return this.run(async () => {
      const result = await this.api<Reply>('/reason', { question: this.question().trim() });
      this.answer.set(result.answer);
      this.sources.set(result.sources);
      this.steps.set(result.steps ?? []);
      this.feedbackDocument.set(result.sources[0]?.id ?? '');
    });
  }
  async addDocument(): Promise<void> {
    return this.run(async () => {
      await this.api<{ id: string }>('/knowledge', { title: this.title(), source: this.source(), content: this.content() });
      this.info.set('Dodano dokument do lokalnej bazy wiedzy.');
      this.content.set('');
      const docs = await this.api<{ documents: Knowledge[] }>('/knowledge');
      this.documents.set(docs.documents);
    });
  }
  async sendFeedback(): Promise<void> {
    return this.run(async () => {
      await this.api('/feedback', { question: this.question(), documentId: this.feedbackDocument(), positive: this.positive() });
      this.info.set('Zapisano ocenę źródła.');
    });
  }
  async train(): Promise<void> {
    return this.run(async () => {
      const report = await this.api<{ accepted: boolean; message: string; validationSamples: number }>('/train', { confirm: true });
      this.info.set(`${report.message} Walidacja: ${report.validationSamples} próbek.`);
    });
  }
  async rollback(): Promise<void> {
    return this.run(async () => {
      await this.api('/rollback', { confirm: true });
      this.info.set('Przywrócono poprzedni model rankera.');
    });
  }
  async previewUrl(): Promise<void> {
    return this.run(async () => {
      const result = await this.api<Preview>('/web/preview', { url: this.url() });
      this.preview.set(result);
    });
  }
  async approveUrl(): Promise<void> {
    return this.run(async () => {
      const preview = this.preview();
      if (!preview) throw new Error('Brak dokumentu do zatwierdzenia.');
      await this.api('/web/approve', { previewId: preview.previewId });
      this.preview.set(null);
      this.info.set('Dokument internetowy dodany po zatwierdzeniu.');
      const docs = await this.api<{ documents: Knowledge[] }>('/knowledge');
      this.documents.set(docs.documents);
    });
  }
}

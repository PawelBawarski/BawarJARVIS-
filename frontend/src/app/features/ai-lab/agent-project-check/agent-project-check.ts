import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { AgentProjectCheckApiService, ProjectCheckResult, ProjectKind, ProjectSource } from '../../../core/services/agent-project-check-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AgentCheckHistory } from '../agent-check-history/agent-check-history';

const MAX_FILES = 500;
const MAX_FILE_BYTES = 524_288;
const MAX_TOTAL_BYTES = 4_194_304;
const ROOT_FILES = new Set(['package.json', 'package-lock.json', 'angular.json', 'tsconfig.json',
  'tsconfig.app.json', 'tsconfig.spec.json', 'tsconfig.base.json', 'pom.xml']);

export function permittedProjectPath(path: string, kind: ProjectKind): boolean {
  if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path) || path.length > 200 ||
      path.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))) return false;
  if (kind === 'angular') {
    return (ROOT_FILES.has(path) && path !== 'pom.xml') ||
      (path.startsWith('src/') && /\.(ts|tsx|html|scss|css|json)$/.test(path)) ||
      (path.startsWith('public/i18n/') && path.endsWith('.json'));
  }
  return path === 'pom.xml' ||
    (/^src\/(main|test)\/java\/.+\.java$/.test(path)) ||
    (/^src\/main\/resources\/db\/migration\/.+\.sql$/.test(path)) ||
    (/^src\/(main|test)\/resources\/.+\.(xml|yml|yaml|properties|json|sql)$/.test(path));
}

export function previewProjectPath(previewPath: string, kind: ProjectKind): string {
  const prefix = kind === 'angular' ? 'frontend/' : 'backend/';
  return previewPath.startsWith(prefix) ? previewPath.slice(prefix.length) : previewPath;
}

@Component({
  selector: 'app-agent-project-check',
  standalone: true,
  imports: [TranslatePipe, AgentCheckHistory],
  templateUrl: './agent-project-check.html',
  styleUrl: './agent-project-check.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentProjectCheck {
  readonly preview = input.required<AgentPatchPreview>();
  readonly enabled = input(false);
  private readonly api = inject(AgentProjectCheckApiService);
  readonly kind = signal<ProjectKind>('angular');
  readonly files = signal<readonly ProjectSource[]>([]);
  readonly uploading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<ProjectCheckResult | null>(null);
  private readonly checked = signal<{ preview: AgentPatchPreview; kind: ProjectKind; filesKey: string } | null>(null);
  readonly currentResult = computed(() => {
    const prior = this.checked();
    const now = this.preview();
    return prior?.kind === this.kind() && prior.filesKey === JSON.stringify(this.files()) &&
      prior.preview.relativePath === now.relativePath && prior.preview.original === now.original &&
      prior.preview.proposed === now.proposed ? this.result() : null;
  });
  readonly validSnapshot = computed(() => {
    const data = this.files();
    const path = previewProjectPath(this.preview().relativePath, this.kind());
    const match = data.find(f => f.path === path);
    const includes = this.kind() === 'angular' ? ['package.json', 'package-lock.json', 'angular.json', 'tsconfig.json'] : ['pom.xml'];
    return match?.content === this.preview().original && includes.every(name => data.some(f => f.path === name));
  });

  changeKind(value: string): void {
    if (value !== 'angular' && value !== 'spring') return;
    this.kind.set(value);
    this.files.set([]);
    this.checked.set(null);
    this.result.set(null);
    this.error.set('');
  }

  async selectDirectory(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    if (this.uploading() || this.busy()) return;
    this.uploading.set(true);
    this.error.set('');
    this.files.set([]);
    this.checked.set(null);
    this.result.set(null);
    try {
      const next: ProjectSource[] = [];
      const names = new Set<string>();
      let size = 0;
      // Only whitelisted source/config files are read. No node_modules, .env, images or secrets directories.
      const candidates = chosen.map(file => ({
        file,
        path: file.webkitRelativePath.includes('/') ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name,
      })).filter(item => permittedProjectPath(item.path, this.kind()));
      if (!candidates.length || candidates.length > MAX_FILES) throw new Error('PROJECT_FILE_COUNT');
      for (const item of candidates) {
        if (!names.add(item.path.toLowerCase()) || item.file.size > MAX_FILE_BYTES) throw new Error('INVALID_PROJECT_FILE');
        size += item.file.size;
        if (size > MAX_TOTAL_BYTES) throw new Error('PROJECT_TOO_LARGE');
        next.push({ path: item.path, content: await item.file.text() });
      }
      this.files.set(next);
      if (!this.validSnapshot()) throw new Error('PROJECT_SOURCE_MISMATCH');
    } catch (e) {
      this.files.set([]);
      this.error.set(e instanceof Error ? e.message : 'PROJECT_FILES_UNAVAILABLE');
    } finally { this.uploading.set(false); }
  }

  async run(): Promise<void> {
    if (!this.enabled() || !this.validSnapshot() || this.uploading() || this.busy()) return;
    const preview = this.preview();
    const kind = this.kind();
    const sources = this.files();
    const filesKey = JSON.stringify(sources);
    this.busy.set(true);
    this.error.set('');
    this.checked.set(null);
    this.result.set(null);
    try {
      const response = await this.api.run(kind, preview, sources);
      const now = this.preview();
      if (preview.relativePath !== now.relativePath || preview.original !== now.original ||
          preview.proposed !== now.proposed || kind !== this.kind() || filesKey !== JSON.stringify(this.files())) return;
      this.checked.set({ preview, kind, filesKey });
      this.result.set(response);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'PROJECT_CHECK_UNAVAILABLE'); }
    finally { this.busy.set(false); }
  }
}

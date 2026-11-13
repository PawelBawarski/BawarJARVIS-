import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AgentPatchPreview } from '../../../core/services/agent-proposal-api';
import { AgentModuleCheckApiService, ModuleCheckResult, ModuleRelatedFile } from '../../../core/services/agent-module-check-api';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const MAX_FILES = 8;
const MAX_FILE_BYTES = 32_768;
const MAX_ALL_BYTES = 131_072;
const JS_TEST = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(test|spec)\.(js|cjs)$/;
const VALID_SOURCE = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(js|cjs|java|ts)$/;

@Component({
  selector: 'app-agent-module-check',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './agent-module-check.html',
  styleUrl: './agent-module-check.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentModuleCheck {
  readonly preview = input.required<AgentPatchPreview>();
  readonly enabled = input(false);
  private readonly api = inject(AgentModuleCheckApiService);
  readonly relatedFiles = signal<readonly ModuleRelatedFile[]>([]);
  readonly chosenTest = signal('');
  readonly busy = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly result = signal<ModuleCheckResult | null>(null);
  private readonly evaluated = signal<{ preview: AgentPatchPreview; files: string; testFile: string } | null>(null);
  readonly mode = computed(() => this.preview().relativePath.toLowerCase().split('.').at(-1) ?? '');
  readonly supported = computed(() => ['ts', 'java', 'js', 'cjs'].includes(this.mode()));
  readonly testOptions = computed(() => this.relatedFiles().filter(f => JS_TEST.test(f.name)).map(f => f.name));
  readonly currentResult = computed(() => {
    const previous = this.evaluated();
    const now = this.preview();
    return previous?.preview.relativePath === now.relativePath &&
      previous?.preview.original === now.original && previous?.preview.proposed === now.proposed &&
      previous.files === JSON.stringify(this.relatedFiles()) && previous.testFile === this.chosenTest()
      ? this.result() : null;
  });

  async pickFiles(event: Event): Promise<void> {
    const element = event.target as HTMLInputElement;
    const files = Array.from(element.files ?? []);
    // Allow the same file to be explicitly reselected.
    element.value = '';
    if (this.busy() || this.uploading()) return;
    this.error.set('');
    this.result.set(null);
    this.evaluated.set(null);
    this.uploading.set(true);
    try {
      if (files.length > MAX_FILES || files.some(f => f.size > MAX_FILE_BYTES || !VALID_SOURCE.test(f.name))) {
        throw new Error('INVALID_MODULE_FILE');
      }
      const baseName = this.preview().relativePath.split('/').at(-1)?.toLowerCase();
      const names = files.map(f => f.name.toLowerCase());
      if (new Set(names).size !== names.length || names.includes(baseName ?? '')) {
        throw new Error('DUPLICATE_MODULE_FILE');
      }
      const currentMode = this.mode();
      if (files.some(f => currentMode === 'java' ? !f.name.endsWith('.java') :
        currentMode === 'ts' ? !f.name.endsWith('.ts') : !/\.(js|cjs)$/.test(f.name))) {
        throw new Error('INCOMPATIBLE_MODULE_FILE');
      }
      const source: ModuleRelatedFile[] = await Promise.all(files.map(async f => ({ name: f.name, content: await f.text() })));
      const encoding = new TextEncoder();
      const all = source.reduce((total, f) => total + encoding.encode(f.content).byteLength, encoding.encode(this.preview().proposed).byteLength);
      if (all > MAX_ALL_BYTES) throw new Error('MODULE_SNAPSHOT_TOO_LARGE');
      this.relatedFiles.set(source);
      this.chosenTest.set(source.find(f => JS_TEST.test(f.name))?.name ?? '');
    } catch (e) {
      this.relatedFiles.set([]);
      this.chosenTest.set('');
      this.error.set(e instanceof Error ? e.message : 'INVALID_MODULE_FILE');
    } finally { this.uploading.set(false); }
  }

  async run(): Promise<void> {
    if (!this.enabled() || !this.supported() || this.busy() || this.uploading()) return;
    const preview = this.preview();
    const related = this.relatedFiles();
    const testFile = this.chosenTest();
    const filesKey = JSON.stringify(related);
    this.busy.set(true);
    this.result.set(null);
    this.evaluated.set(null);
    this.error.set('');
    try {
      const result = await this.api.run(preview, related, testFile);
      if (preview.relativePath !== this.preview().relativePath || preview.original !== this.preview().original ||
          preview.proposed !== this.preview().proposed || filesKey !== JSON.stringify(this.relatedFiles()) ||
          testFile !== this.chosenTest()) return;
      this.evaluated.set({ preview, files: filesKey, testFile });
      this.result.set(result);
    } catch (e) {
      // Error messages are diagnostic codes; the localized caption describes the failure.
      this.error.set(e instanceof Error ? e.message : 'MODULE_CHECK_UNAVAILABLE');
    } finally { this.busy.set(false); }
  }
}

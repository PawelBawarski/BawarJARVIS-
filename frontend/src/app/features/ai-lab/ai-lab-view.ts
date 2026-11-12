import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LearningLab } from './learning-lab/learning-lab';
import { ResearchMemory } from './research-memory/research-memory';
import { AgentPlanner } from './agent-planner/agent-planner';
import { AiLabWorkspacePanel } from './workspace-panel/workspace-panel';
import { AiTrainingPanel } from './training-panel/training-panel';
import { ModuleHelpService } from '../../core/services/module-help.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-view',
  standalone: true,
  imports: [AiLabWorkspacePanel, AiTrainingPanel, TranslatePipe, LearningLab, ResearchMemory, AgentPlanner],
  templateUrl: './ai-lab-view.html',
  styleUrl: './ai-lab-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiLabView {
  readonly help = inject(ModuleHelpService);
  readonly advancedOpen = signal(false);
  readonly offlineOpen = signal(false);

  onAdvancedToggle(event: Event): void {
    this.advancedOpen.set((event.target as HTMLDetailsElement).open);
  }

  onOfflineToggle(event: Event): void {
    this.offlineOpen.set((event.target as HTMLDetailsElement).open);
  }
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ResearchMemory } from './research-memory/research-memory';
import { AgentPlanner } from './agent-planner/agent-planner';
import { LoraTraining } from './lora-training/lora-training';
import { LoraEvidencePanel } from './lora-evidence/lora-evidence';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-view',
  standalone: true,
  imports: [ResearchMemory, AgentPlanner, LoraEvidencePanel, LoraTraining, TranslatePipe],
  templateUrl: './ai-lab-view.html',
  styleUrl: './ai-lab-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiLabView {
  readonly trainingOpen = signal(false);
  onTrainingToggle(event: Event): void {
    this.trainingOpen.set((event.target as HTMLDetailsElement).open);
  }
}

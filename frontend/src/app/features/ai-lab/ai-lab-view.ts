// JARVIS_15_RESEARCH_MEMORY
import { LearningLab } from './learning-lab/learning-lab';
import { ResearchMemory } from './research-memory/research-memory';
import { AgentPlanner } from './agent-planner/agent-planner'; // JARVIS_STAGE16_PLANNER
import { AiLabWorkspacePanel } from './workspace-panel/workspace-panel';
import { AiTrainingPanel } from './training-panel/training-panel';
import { Component, inject } from '@angular/core';
import { ModuleHelpService } from '../../core/services/module-help.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-view',
  standalone: true,
  imports: [AiLabWorkspacePanel, AiTrainingPanel, TranslatePipe, LearningLab, ResearchMemory, AgentPlanner],
  templateUrl: './ai-lab-view.html',
  styleUrl: './ai-lab-view.scss',
})
export class AiLabView {
  readonly help = inject(ModuleHelpService);
}

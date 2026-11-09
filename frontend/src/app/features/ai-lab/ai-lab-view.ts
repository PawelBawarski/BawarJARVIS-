import { AiLabWorkspacePanel } from './workspace-panel/workspace-panel';
import { AiTrainingPanel } from './training-panel/training-panel';
import { Component } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-view',
  standalone: true,
  imports: [AiLabWorkspacePanel, AiTrainingPanel, TranslatePipe],
  templateUrl: './ai-lab-view.html',
  styleUrl: './ai-lab-view.scss',
})
export class AiLabView {}

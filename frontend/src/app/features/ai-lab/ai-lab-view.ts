import { Component } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-lab-view',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './ai-lab-view.html',
  styleUrl: './ai-lab-view.scss',
})
export class AiLabView {}

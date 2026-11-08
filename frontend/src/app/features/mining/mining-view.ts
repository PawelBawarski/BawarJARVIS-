import { Component } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-mining-view',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './mining-view.html',
  styleUrl: './mining-view.scss',
})
export class MiningView {}

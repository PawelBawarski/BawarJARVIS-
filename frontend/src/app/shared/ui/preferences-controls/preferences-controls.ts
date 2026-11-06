import { Component } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-preferences-controls',
  styleUrl: './preferences-controls.scss',
  templateUrl: './preferences-controls.html',
  imports: [TranslatePipe],
})
export class PreferencesControls {}

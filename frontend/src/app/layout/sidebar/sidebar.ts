
import { Component } from '@angular/core';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PreferencesControls } from '../../shared/ui/preferences-controls/preferences-controls';

@Component({
  selector: 'app-sidebar',
  imports: [TranslatePipe, PreferencesControls],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {}

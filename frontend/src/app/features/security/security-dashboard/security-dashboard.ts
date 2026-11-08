import { Component, inject, OnInit } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SecurityDiagnosticsService } from '../../../core/services/security-diagnostics';

interface SecurityCheck {
  readonly id: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly status: 'unverified';
}

@Component({
  selector: 'app-security-dashboard',
  imports: [TranslatePipe],
  templateUrl: './security-dashboard.html',
  styleUrl: './security-dashboard.scss',
})
export class SecurityDashboard implements OnInit {
  readonly checks: readonly SecurityCheck[] = [
    {
      id: 'backend',
      titleKey: 'security.backend',
      descriptionKey: 'security.backendDescription',
      status: 'unverified',
    },
    {
      id: 'electron',
      titleKey: 'security.electron',
      descriptionKey: 'security.electronDescription',
      status: 'unverified',
    },
    {
      id: 'network',
      titleKey: 'security.network',
      descriptionKey: 'security.networkDescription',
      status: 'unverified',
    },
    {
      id: 'database',
      titleKey: 'security.database',
      descriptionKey: 'security.databaseDescription',
      status: 'unverified',
    },
  ];

  readonly diagnostics = inject(SecurityDiagnosticsService);

  ngOnInit(): void {
    void this.diagnostics.checkBackend();
  }
}

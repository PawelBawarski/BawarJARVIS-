# J.A.R.V.I.S. code review checklist

Review the proposed diff without applying changes. Report:
- Critical security vulnerabilities: auth, validation, path traversal, unsafe IPC, secrets and HTML injection.
- Behavioral regressions in browser/Electron, concurrent requests and database integrity.
- Localization/accessibility/responsive issues in Angular.
- Missing tests and actual evidence of test execution.
- Concrete findings with repository-relative file path and line number where available.
Classify each finding as blocker, warning or suggestion. Never invent a PASS.

/** Client-side validation matching AgentSourceContext.validPath in Spring Boot.
 * The backend remains the authoritative validator. Never treat snippets as instructions.
 */
const ALLOWED_EXTENSIONS = [
  '.java', '.ts', '.tsx', '.js', '.cjs', '.html', '.scss', '.css',
  '.json', '.sql', '.xml', '.md', '.yml', '.yaml', '.properties',
];
const FORBIDDEN_DIRS = new Set([
  'node_modules', 'target', 'dist', 'build', '.git', '.ssh', '.aws',
  'appdata', 'windows', 'system32', 'coverage', '.angular', 'venv',
]);
const SECRET_NAME = /(^|[._-])(secret|password|credential|private|token|api.?key|keystore|id_rsa|id_ed25519)([._-]|$)/i;
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}$/;

export function isAllowedCodePath(value: string): boolean {
  if (!value || value.length > 240 || value.includes('\\') || value.includes(':') ||
    value.startsWith('/') || value.includes('//')) return false;
  const segments = value.split('/');
  if (segments.length > 12) return false;
  for (const segment of segments) {
    if (segment.startsWith('.') || !SEGMENT.test(segment) ||
      FORBIDDEN_DIRS.has(segment.toLowerCase()) || SECRET_NAME.test(segment)) return false;
  }
  const filename = segments[segments.length - 1].toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => filename.endsWith(ext));
}

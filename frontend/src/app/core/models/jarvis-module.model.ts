export interface JarvisModule {
  readonly id: string;
  readonly labelKey: string;
}

export const JARVIS_MODULES = [
  {
    id: 'chat',
    labelKey: 'workspace.chat',
  },
  {
    id: 'lab',
    labelKey: 'workspace.lab',
  },
  {
    id: 'security',
    labelKey: 'workspace.security',
  },
] as const satisfies readonly JarvisModule[];

export type JarvisModuleId = (typeof JARVIS_MODULES)[number]['id'];

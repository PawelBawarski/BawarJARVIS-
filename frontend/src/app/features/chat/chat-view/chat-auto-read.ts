/** Select only the assistant reply created by this particular explicit Chat send. */
export function selectNewAssistantReply(
  messages: readonly { id: string; role: string; content: string }[],
  beforeIds: ReadonlySet<string>,
  question: string,
): { id: string; content: string } | null {
  const assistant = messages.at(-1);
  const user = messages.at(-2);
  if (!assistant || !user || assistant.role !== 'assistant' || user.role !== 'user' ||
      user.content !== question || beforeIds.has(assistant.id) || !assistant.content.trim()) return null;
  return { id: assistant.id, content: assistant.content };
}

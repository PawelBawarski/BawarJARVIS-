import { describe, expect, it } from 'vitest';
import { selectNewAssistantReply } from './chat-auto-read';
const messages = [
  {id:'u-new', role:'user', content:'test'},
  {id:'a-new', role:'assistant', content:'answer'},
];
describe('Chat auto narration consent boundaries', () => {
  it('selects only a newly created matching assistant reply', () =>
    expect(selectNewAssistantReply(messages, new Set(['u-old','a-old']), 'test'))
      .toEqual({ id:'a-new', content:'answer' }));
  it('does not replay existing history', () =>
    expect(selectNewAssistantReply(messages, new Set(['a-new']), 'test')).toBeNull());
  it('ignores stale conversation and unrelated send', () =>
    expect(selectNewAssistantReply(messages, new Set(), 'another question')).toBeNull());
  it('ignores blank replies or user-only messages', () => {
    expect(selectNewAssistantReply([{id:'u',role:'user',content:'test'}],new Set(),'test')).toBeNull();
    expect(selectNewAssistantReply([messages[0],{...messages[1],content:'  '}],new Set(),'test')).toBeNull();
  });
});

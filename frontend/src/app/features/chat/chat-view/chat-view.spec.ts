
import { TestBed } from '@angular/core/testing';
import { ChatView } from './chat-view';

describe('ChatView', () => {
  it('should display the welcome message', async () => {
    const fixture = TestBed.createComponent(ChatView);
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Cześć! Jestem Jarvis.');
  });

  it('should add a user message', async () => {
    const fixture = TestBed.createComponent(ChatView);
    const component = fixture.componentInstance;

    component.draft.set('Cześć Jarvis');
    component.sendMessage();

    await fixture.whenStable();

    const userMessage = fixture.nativeElement
      .querySelector('.message--user');

    expect(userMessage.textContent)
      .toContain('Cześć Jarvis');

    expect(component.draft()).toBe('');
  });

  it('should ignore empty messages', () => {
    const fixture = TestBed.createComponent(ChatView);
    const component = fixture.componentInstance;

    component.draft.set('   ');
    component.sendMessage();

    expect(component.messages().length).toBe(1);
  });
});

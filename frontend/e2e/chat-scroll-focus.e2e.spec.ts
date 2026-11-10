import { test, expect } from '@playwright/test';

test('chat: Enter and button preserve focus, scroll to latest messages', async ({ page }) => {
  let count = 0;
  await page.addInitScript(() => {
    const old = (window as any).jarvisDesktop || {};
    (window as any).jarvisDesktop = {
      ...old,
      chatApi: async (q: any) => {
        if (q.operation === 'list') return {ok:true,status:200,data:[]};
        if (q.operation === 'create') return {ok:true,status:201,data:{id:'c1',title:'Nowa',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};
        if (q.operation === 'messages') return {ok:true,status:200,data:[]};
        if (q.operation === 'send') {
          await new Promise(r => setTimeout(r, 100));
          return {ok:true,status:200,data:{
            userMessage:{id:crypto.randomUUID(),role:'USER',content:q.content,conversationId:'c1',order:1},
            assistantMessage:{id:crypto.randomUUID(),role:'ASSISTANT',content:'Odpowiedź: '+q.content,conversationId:'c1',order:2},
          }};
        }
        return {ok:false,status:400,error:'INVALID'};
      },
    };
  });
  await page.goto('/');
  const input = page.getByTestId('chat-input');
  await expect(input).toBeVisible();
  await input.fill('Pytanie z Enter');
  await input.press('Enter');
  await expect(page.getByText('Odpowiedź: Pytanie z Enter')).toBeVisible();
  await expect(input).toBeFocused();
  const pane = page.getByTestId('chat-messages');
  await expect.poll(() => pane.evaluate(el => Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop)<4)).toBe(true);
  await input.fill('Pytanie przyciskiem');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('Odpowiedź: Pytanie przyciskiem')).toBeVisible();
  await expect(input).toBeFocused();
});

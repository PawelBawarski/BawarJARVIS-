import { expect, test } from '@playwright/test';

test('Chat: + / trash outside menu, flat audio controls, no memory sources', async ({page}) => {
  await page.goto('/chat');
  const bar = page.locator('.chat-header__actions');
  // Assert actual placement, not a brittle :scope CSS selector.
  const newButton = bar.getByTestId('chat-header-new');
  const deleteButton = bar.getByTestId('chat-header-delete');
  const menuButton = bar.getByTestId('chat-tools-toggle');
  await expect(newButton).toBeVisible();
  await expect(deleteButton).toBeVisible();
  await expect(menuButton).toBeVisible();
  const newBox = await newButton.boundingBox();
  const deleteBox = await deleteButton.boundingBox();
  const menuBox = await menuButton.boundingBox();
  expect(newBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(newBox!.x).toBeLessThan(deleteBox!.x);
  expect(deleteBox!.x).toBeLessThan(menuBox!.x);
  expect(Math.abs(newBox!.y - deleteBox!.y)).toBeLessThan(4);
  expect(Math.abs(deleteBox!.y - menuBox!.y)).toBeLessThan(4);
  await expect(page.getByTestId('chat-sources-toggle')).toHaveCount(0);
  await expect(page.getByTestId('chat-rag-sources')).toHaveCount(0);
  await bar.getByTestId('chat-tools-toggle').click();
  const menu = bar.getByTestId('chat-tools-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('chat-auto-read')).toBeVisible();
  await expect(menu.getByTestId('voice-start')).toBeVisible();
  await expect(menu.getByTestId('chat-header-new')).toHaveCount(0);
  await expect(menu.getByTestId('chat-header-delete')).toHaveCount(0);
  const flat = menu.locator('.voice-conversation__actions');
  await expect(flat).toHaveCSS('display','contents');
  const visible = menu.locator('button:visible');
  const styles = await visible.evaluateAll(nodes => nodes.map(n => {
    const s=getComputedStyle(n);
    return { width:Math.round(n.getBoundingClientRect().width), bg:s.backgroundColor,
      border:s.borderTopWidth, radius:s.borderRadius };
  }));
  expect(styles.length).toBeGreaterThanOrEqual(3);
  for (const style of styles.slice(1)) expect(style).toEqual(styles[0]);
});

test('Chat UX: automatic reading is opt-in and applies only after new send', async ({page}) => {
  await page.addInitScript(() => {
    const now=new Date().toISOString();
    const chat={id:'chat-ux-1',title:'Voice',createdAt:now,updatedAt:now};
    (window as any).jarvisDesktop={chatApi: async (r: {operation:string; content?:string}) => {
      if(r.operation==='list')return {ok:true,status:200,data:[chat]};
      if(r.operation==='messages')return {ok:true,status:200,data:[{id:'old-answer',role:'ASSISTANT',content:'Existing history',conversationId:chat.id,createdAt:now,order:1}]};
      if(r.operation==='modelStatus')return {ok:true,status:200,data:{ready:true,model:'qwen'}};
      if(r.operation==='send')return {ok:true,status:200,data:{
        userMessage:{id:'new-user',role:'USER',content:r.content,conversationId:chat.id,createdAt:now,order:2},
        assistantMessage:{id:'new-answer',role:'ASSISTANT',content:'New reply',conversationId:chat.id,createdAt:now,order:3}}};
      return {ok:false,status:503,error:'unavailable'};
    }};
    (window as any).Audio=class {paused=true; onended:any; async play(){this.paused=false;} pause(){this.paused=true;} load(){} removeAttribute(_name:string){} };
    URL.createObjectURL=()=> 'blob:ux'; URL.revokeObjectURL=()=>{};
  });
  let synthesis=0;
  await page.route('**/api/ai-lab/tts/status', r=>r.fulfill({json:{enabled:true,configuredPl:true,configuredEn:true}}));
  await page.route('**/api/ai-lab/tts/synthesize',r=>{synthesis++;return r.fulfill({contentType:'audio/wav',body:Buffer.alloc(48)});});
  await page.goto('/chat');
  await expect(page.getByTestId('chat-messages')).toContainText('Existing history');
  expect(synthesis).toBe(0);
  await page.getByTestId('chat-tools-toggle').click();
  await page.getByTestId('chat-auto-read').click();
  await expect(page.getByTestId('chat-auto-read')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('chat-tools-toggle').click();
  await expect(page.getByTestId('chat-tools-menu')).toBeHidden();
  await page.getByTestId('chat-input').fill('Hello');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-messages')).toContainText('New reply');
  await expect.poll(()=>synthesis).toBe(1);
  await page.getByTestId('chat-tools-toggle').click();
  await page.getByTestId('chat-auto-read').click();
  await expect(page.getByTestId('chat-auto-read')).toHaveAttribute('aria-pressed','false');
});

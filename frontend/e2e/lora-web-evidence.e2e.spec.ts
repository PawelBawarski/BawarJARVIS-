import { test,expect } from '@playwright/test';
test('AI Lab web search proposals require manual review and have export control',async({page})=>{
 let approved=false;
 const item={id:'22222222-2222-4222-8222-222222222222',query:'Angular',title:'Official documentation',url:'https://angular.dev',excerpt:'Angular overview',instruction:'',response:'',approved:false};
 await page.route('**/api/ai-lab/lora/evidence**',async route=>{
  const url=route.request().url(),method=route.request().method();
  if(method==='POST' && url.endsWith('/search'))return route.fulfill({json:[item]});
  if(method==='PATCH'){approved=true;return route.fulfill({json:{...item,approved:true}});}
  if(method==='POST' && url.endsWith('/export'))return route.fulfill({json:{id:'reviewed-test',examples:2,path:'test'}});
  return route.fulfill({json:[{...item,approved}]});
 });
 await page.goto('/lab');await page.getByTestId('jarvis-lab-existing').locator(':scope > summary').click();
 const panel=page.getByTestId('lora-web-evidence');await expect(panel).toBeVisible();
 await expect(page.getByTestId('lora-export')).toBeDisabled();
 await page.getByTestId('lora-web-query').fill('Angular');await page.getByTestId('lora-web-search').click();
 await expect(panel.getByText('Official documentation')).toBeVisible();
});

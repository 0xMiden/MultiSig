import {expect,test} from '@playwright/test';
test('production app loads the real USB SDK and opens the Ledger dialog',async({page})=>{
  const ledgerRequests:string[]=[];
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('ledger.com'))ledgerRequests.push(request.url());});
  const cspViolations:string[]=[];
  page.on('console',message=>{if(/Content Security Policy/i.test(message.text()))cspViolations.push(message.text());});
  await page.goto('/login');
  await page.getByRole('button',{name:'MIDEN WALLET',exact:true}).click();
  await page.getByRole('button',{name:'CONNECT LEDGER (USB)',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Connect Ledger'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose USB device'})).toBeEnabled({timeout:15000});
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  expect(ledgerRequests).toEqual([]);
  // The USB SDK and WASM must load under the production Content-Security-Policy.
  const response=await page.request.get('/login');
  expect(response.headers()['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic' 'wasm-unsafe-eval';/);
  expect(cspViolations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

import {expect,test} from '@playwright/test';
test('production app loads the real USB SDK and opens the Ledger dialog',async({page})=>{
  const ledgerRequests:string[]=[];
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('ledger.com'))ledgerRequests.push(request.url());});
  await page.goto('/login');
  await page.getByRole('button',{name:'MIDEN WALLET',exact:true}).click();
  await page.getByRole('button',{name:'CONNECT LEDGER (USB)',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Connect Ledger'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose USB device'})).toBeEnabled({timeout:15000});
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  expect(ledgerRequests).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

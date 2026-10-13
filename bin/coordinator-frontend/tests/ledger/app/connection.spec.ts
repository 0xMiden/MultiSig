import {expect,test} from '@playwright/test';
// The endpoints the build was configured with (CI passes the same values to
// the build and to this suite). Required: without them nothing is checked.
const ENDPOINTS=['NEXT_PUBLIC_MIDEN_RPC_URL','NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL','NEXT_PUBLIC_GUARDIAN_ENDPOINT'];
test('production app loads the real USB SDK and opens the Ledger dialog',async({page})=>{
  const ledgerRequests:string[]=[];
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('ledger.com'))ledgerRequests.push(request.url());});
  const cspViolations:string[]=[];
  page.on('console',message=>{if(/Content Security Policy/i.test(message.text()))cspViolations.push(message.text());});
  // The Miden SDK's WASM: proves the client started under the production CSP
  // (a misconfigured build stops before loading it).
  const midenWasm:string[]=[];
  page.on('request',request=>{if(/miden_client_web[^/]*\.wasm$/.test(new URL(request.url()).pathname))midenWasm.push(request.url());});
  await page.goto('/login');
  // The wallet button names the source and whether it is connected.
  await page.getByRole('button',{name:/^MIDEN WALLET( · NOT CONNECTED)?$/}).click();
  await page.getByRole('button',{name:'CONNECT LEDGER (USB)',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Connect Ledger'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose USB device'})).toBeEnabled({timeout:15000});
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  expect(ledgerRequests).toEqual([]);
  // The USB SDK and WASM must load under the production Content-Security-Policy.
  const response=await page.request.get('/login');
  expect(response.headers()['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic' 'wasm-unsafe-eval';/);
  await expect.poll(()=>midenWasm.length,{timeout:30000}).toBeGreaterThan(0);
  await expect(page.getByText(/This deployment is misconfigured/)).toHaveCount(0);
  // connect-src must admit every configured endpoint: the Miden client and
  // Guardian reach them from this page. Each is probed from the page and the
  // probe answered here (a request the CSP blocks never reaches the route), so
  // this does not depend on those services being up.
  const endpoints=ENDPOINTS.map(name=>{const value=process.env[name];expect(value,`${name} must be set for this suite`).toBeTruthy();return value!;});
  await page.route(/\/__csp_probe$/,route=>route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}}));
  const blocked=await page.evaluate(async urls=>{
    const refused:string[]=[];
    for(const url of urls){try{await fetch(`${url.replace(/\/+$/,'')}/__csp_probe`);}catch{refused.push(url);}}
    return refused;
  },endpoints);
  expect(blocked).toEqual([]);
  expect(cspViolations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

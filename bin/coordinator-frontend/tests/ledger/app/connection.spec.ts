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
// A store left by another network. The node's Status is answered here (its
// genesis differs from the seeded marker), so this does not depend on the node
// being up. A returning user with an account cookie lands on the dashboard, so
// the notice must reach that route as well as the login page.
const varint=(n:number)=>{const out:number[]=[];do{out.push((n&127)|(n>127?128:0));n=Math.floor(n/128);}while(n);return out;};
const field=(number:number,bytes:number[])=>[...varint(number*8+2),...varint(bytes.length),...bytes];
const frame=(flag:number,bytes:number[])=>[flag,(bytes.length>>>24)&255,(bytes.length>>>16)&255,(bytes.length>>>8)&255,bytes.length&255,...bytes];
const STATUS_BODY=Buffer.from([
  ...frame(0,[...field(1,[...Buffer.from('0.17.3')]),...field(2,field(1,Array(32).fill(0x11)))]),
  ...frame(128,[...Buffer.from('grpc-status:0\r\n')]),
]);
for(const {route,cookie} of [{route:'/dashboard/home',cookie:true},{route:'/login',cookie:false}]){
  test(`the user is told that a store left by another network was cleared on ${route}`,async({page,context,baseURL})=>{
    const rpc=process.env.NEXT_PUBLIC_MIDEN_RPC_URL;
    expect(rpc,'NEXT_PUBLIC_MIDEN_RPC_URL must be set for this suite').toBeTruthy();
    await page.route(`${rpc!.replace(/\/+$/,'')}/miden.node.v1.NodeService/Status`,r=>r.fulfill(r.request().method()==='OPTIONS'
      ?{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST','access-control-allow-headers':'content-type,x-grpc-web'}}
      :{status:200,headers:{'content-type':'application/grpc-web+proto','access-control-allow-origin':'*'},body:STATUS_BODY}));
    if(cookie)await context.addCookies([{name:'currentWalletId',value:`0x${'1'.repeat(30)}`,url:baseURL!}]);
    // Seeded once, on the first document only.
    await page.addInitScript(()=>{
      if(sessionStorage.getItem('seeded'))return;
      sessionStorage.setItem('seeded','1');
      localStorage.setItem('midenStoreSdkVersion','0.17.3');
      localStorage.setItem('midenStoreNetwork','https://rpc.other.example genesis 0x00');
    });
    await page.goto(route);
    const notice=page.getByRole('status').filter({hasText:/left here by another network was cleared/});
    await expect(notice).toBeVisible({timeout:60000});
    await notice.getByRole('button',{name:'Dismiss'}).click();
    await expect(notice).toHaveCount(0);
  });
}

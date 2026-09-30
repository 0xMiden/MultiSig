import {expect,test} from '@playwright/test';
test('Ledger signer executes every supported flow against Guardian and Miden',async({page})=>{
  test.setTimeout(900_000);
  const required=['LEDGER_TEST_RPC_URL','LEDGER_TEST_GUARDIAN_URL','LEDGER_TEST_TRANSPORT_URL'] as const;
  for(const key of required) if(!process.env[key]) throw new Error(`Set ${key} to an isolated test service. This suite does not silently skip missing services.`);
  page.on('console',message=>{if(message.type()==='info') console.info(message.text());});
  await page.goto('/services.html');
  await page.waitForFunction(()=>typeof window.runLedgerServiceSuite==='function');
  const result=await page.evaluate(options=>window.runLedgerServiceSuite(options),{
    rpcUrl:process.env.LEDGER_TEST_RPC_URL!,guardianUrl:process.env.LEDGER_TEST_GUARDIAN_URL!,transportUrl:process.env.LEDGER_TEST_TRANSPORT_URL!,
    invitationCode:process.env.LEDGER_TEST_INVITATION_CODE??'guardian',sendAmount:process.env.LEDGER_TEST_SEND_AMOUNT??'10000',
  });
  expect(result.passed).toHaveLength(11);
  console.info(JSON.stringify(result));
});

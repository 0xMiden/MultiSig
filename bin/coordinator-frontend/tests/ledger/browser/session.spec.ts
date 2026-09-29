import { expect, test } from '@playwright/test';
test.beforeEach(async ({page}) => { page.on('pageerror', error => console.error(error)); });
async function connect(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await page.getByRole('button', {name:'Choose USB device'}).click();
  await expect(page.getByRole('list', {name:'Ledger addresses'}).getByRole('button')).toHaveCount(5);
}
test('chooses a paginated address, confirms, signs, and invalidates on unplug', async ({page}) => {
  await connect(page);
  await page.getByRole('button', {name:'Load more addresses'}).click();
  const addresses=page.getByRole('list', {name:'Ledger addresses'}).getByRole('button');
  await expect(addresses).toHaveCount(10);
  await addresses.nth(6).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('path')).toHaveText("44'/60'/6'/0/0");
  await expect(page.getByTestId('identity')).toHaveText(/^0x[\da-f]{64}$/);
  await page.getByRole('button', {name:'Sign summary'}).click();
  await expect(page.getByTestId('signature')).toHaveText(/^0x[\da-f]{130}$/);
  await page.getByRole('button', {name:'Unplug', exact:true}).click();
  await expect(page.getByTestId('identity')).toHaveText('Disconnected');
  await expect(page.getByRole('button', {name:'Sign summary'})).toBeDisabled();
});
test('rejected address does not create a signer and can be retried', async ({page}) => {
  await page.goto('/'); await page.getByLabel('Reject on device').check();
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await page.getByRole('button', {name:'Choose USB device'}).click();
  await page.getByRole('list', {name:'Ledger addresses'}).getByRole('button').first().click();
  await expect(page.getByRole('alert')).toContainText('User rejected');
  await expect(page.getByTestId('identity')).toHaveText('Disconnected');
  await page.getByRole('button', {name:'Close Ledger connection'}).click();
  await page.getByLabel('Reject on device').uncheck();
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await page.getByRole('button', {name:'Choose USB device'}).click();
  await page.getByLabel('Address layout').selectOption('legacy');
  await page.getByRole('list', {name:'Ledger addresses'}).getByRole('button').nth(2).click();
  await expect(page.getByTestId('path')).toHaveText("44'/60'/0'/0/2");
});
test('escape closes discovery and permits reconnect', async ({page}) => {
  await connect(page); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await page.getByRole('button', {name:'Choose USB device'}).click();
  await expect(page.getByRole('list', {name:'Ledger addresses'}).getByRole('button')).toHaveCount(5);
});
test('service test harness loads without connecting to services', async ({page}) => {
  await page.goto('/services.html');
  await page.waitForFunction(()=>typeof window.runLedgerServiceSuite==='function');
});
test('browsing addresses keeps the current signer until another address is confirmed', async ({page}) => {
  await connect(page);
  const addresses=page.getByRole('list', {name:'Ledger addresses'}).getByRole('button');
  await addresses.first().click();
  const identity=page.getByTestId('identity');
  await expect(identity).toHaveText(/^0x[\da-f]{64}$/);
  const first=await identity.textContent();
  // Opening the dialog to browse must not tear down the session (review C1).
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await expect(addresses).toHaveCount(5);
  await expect(identity).toHaveText(first!);
  await page.getByRole('button', {name:'Close Ledger connection'}).click();
  await expect(identity).toHaveText(first!);
  await page.getByRole('button', {name:'Sign summary'}).click();
  await expect(page.getByTestId('signature')).toHaveText(/^0x[\da-f]{130}$/);
  // Re-confirming the same address keeps the same signer.
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await addresses.first().click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(identity).toHaveText(first!);
});
test('changing the selected address replaces the signer and retires the old one', async ({page}) => {
  await connect(page);
  const addresses=page.getByRole('list', {name:'Ledger addresses'}).getByRole('button');
  await addresses.first().click();
  const identity=page.getByTestId('identity');
  await expect(identity).toHaveText(/^0x[\da-f]{64}$/);
  const first=await identity.textContent();
  await page.getByRole('button', {name:'Keep signer'}).click();
  await page.getByRole('button', {name:'Connect', exact:true}).click();
  await addresses.nth(1).click();
  await expect(page.getByTestId('path')).toHaveText("44'/60'/1'/0/0");
  await expect(identity).toHaveText(/^0x[\da-f]{64}$/);
  await expect(identity).not.toHaveText(first!);
  await page.getByRole('button', {name:'Sign with kept signer'}).click();
  await expect(page.getByTestId('signature')).not.toHaveText(/^0x[\da-f]{130}$/);
  await expect(page.getByTestId('signature')).not.toBeEmpty();
});

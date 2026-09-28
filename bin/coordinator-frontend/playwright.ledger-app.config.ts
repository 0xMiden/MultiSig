import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/ledger/app',workers:1,
  use:{baseURL:'http://127.0.0.1:4174',headless:true,launchOptions:process.env.LEDGER_TEST_BROWSER?{executablePath:process.env.LEDGER_TEST_BROWSER}:{}},
  webServer:{command:'npm run start -- --hostname 127.0.0.1 --port 4174',url:'http://127.0.0.1:4174/login',reuseExistingServer:false},
});

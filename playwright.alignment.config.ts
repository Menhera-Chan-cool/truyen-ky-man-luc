import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'e2e',testMatch:/(novel-lookup|novel-contextual|novel-poetry-tracks|novel-poetry-reader)\.spec\.ts/,workers:1,timeout:60000,reporter:[['list']],
 use:{baseURL:process.env.BASE_URL??'http://127.0.0.1:3006',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'android-phone',use:{...devices['Pixel 7']}},{name:'webkit-phone',use:{...devices['iPhone 13'],defaultBrowserType:'webkit'}}]});

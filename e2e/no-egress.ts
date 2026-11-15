import {test as base,expect} from '@playwright/test';
// Fonts and covers are served from the real Supabase project; no lookup assertion needs their bytes, so stub them instead of spending egress on every page.
export const test=base.extend({context:async({context},use)=>{await context.route(/\/api\/(?:heading-fonts|assets)\//,route=>route.fulfill({status:204}));await use(context);}});
export {expect};
export type {Page} from '@playwright/test';

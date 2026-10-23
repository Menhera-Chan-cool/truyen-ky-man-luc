import {createRequire} from 'node:module';
import {randomUUID,randomBytes} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../package.json',import.meta.url));
require('@next/env').loadEnvConfig(root,false,{info(){},error(){}});
const {createClient}=require('@supabase/supabase-js'),{chromium}=require('@playwright/test');
const config={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,config);
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,config);
const tag=randomUUID().slice(0,8),ids=['preface','one','two'].map(s=>'verify-editor-'+tag+'-'+s);
const email='verify-editor-'+tag+'@example.test',password=randomBytes(24).toString('base64url')+'aA1!';
const base=process.env.BASE_URL??process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000';
let uid,browser,phase='setup';const report={base,checks:[],cleanup:[]};
function ok(r){if(r.error)throw Error('Request failed '+(r.error.code??r.error.status??''));return r.data;}
async function clean(label,fn){try{ok(await fn());report.cleanup.push({label,ok:true});}catch{report.cleanup.push({label,ok:false});}}
try{
 uid=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
 ok(await admin.from('members').insert({user_id:uid,email,role:'editor',active:true}));
 ok(await client.auth.signInWithPassword({email,password}));
 for(const id of ids)for(const locale of ['vi','en'])ok(await client.rpc('save_chapter',{p_id:id,p_locale:locale,p_title:'QA '+id+' '+locale,p_html:'<p>ORIGINAL '+id+' '+locale+'</p>',p_kind:'text',p_pdf_path:null,p_expected_revision:0}));
 browser=await chromium.launch();
 for(const locale of ['vi','en']){
  phase='open '+locale;
  const page=await browser.newPage();page.on('dialog',d=>d.dismiss());
  const statePayloads=[];
  page.on('response',async response=>{
   if(new URL(response.url()).pathname==='/api/admin/state' && response.ok()){
    const state=await response.json();statePayloads.push(state);
   }
  });
  await page.goto(base+'/admin?lang='+locale);
  await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(password);
  await page.getByRole('button',{name:locale==='vi'?'Đăng nhập':'Sign in',exact:true}).click();
  await page.locator('.editor-chapter').first().waitFor({timeout:45000});
  for(const id of ids){
   phase='select original '+locale+' '+id;
   await page.locator('.editor-chapter').filter({hasText:id}).locator('button').first().click();
   await page.waitForFunction(id=>document.querySelector('.editor-surface input[maxlength="300"]')?.value==='QA '+id+' '+document.documentElement.lang,id);
   await page.locator('.tiptap').waitFor();
   assert.equal((await page.locator('.tiptap').innerText()).includes('ORIGINAL '+id+' '+locale),true);
   phase='paste and save '+locale+' '+id;
   const marker='PASTED '+locale+' '+id;
   await page.locator('.tiptap').click();
   await page.locator('.tiptap').press('ControlOrMeta+A');
   await page.locator('.tiptap').evaluate((el,marker)=>{
    const dt=new DataTransfer();dt.setData('text/plain',marker);dt.setData('text/html','<p><strong>'+marker+'</strong></p>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
   },marker);
   assert.equal((await page.locator('.tiptap').innerText()).trim(),marker);
   await page.getByRole('button',{name:locale==='vi'?'Lưu bản nháp':'Save draft',exact:true}).click();
   await page.getByRole('status').filter({hasText:locale==='vi'?'Đã lưu bản nháp':'Draft saved'}).waitFor({timeout:45000});
  }
  for(const id of ids){
   phase='verify saved '+locale+' '+id;
   await page.locator('.editor-chapter').filter({hasText:id}).locator('button').first().click();
   await page.waitForFunction(marker=>document.querySelector('.tiptap')?.textContent?.trim()===marker,'PASTED '+locale+' '+id);
   assert.equal((await page.locator('.tiptap').innerText()).trim(),'PASTED '+locale+' '+id);
  }
  await page.reload();await page.locator('.editor-chapter').first().waitFor({timeout:45000});
  for(const id of ids){
   const edition=ok(await admin.from('chapter_editions').select('draft_id,published_id').eq('chapter_id',id).eq('locale',locale).single());
   const version=ok(await admin.from('chapter_versions').select('html').eq('id',edition.draft_id).single());
   assert.equal(version.html.includes('PASTED '+locale+' '+id),true);assert.equal(edition.published_id,null);
  }
  assert(statePayloads.length>0);
  assert(statePayloads.every(s=>s.versions.every(v=>!Object.hasOwn(v,'html'))));
  let delayed=false;
  await page.route('**/api/admin/chapters?*',async route=>{
   const url=new URL(route.request().url());
   if(url.searchParams.get('id')===ids[0] && url.searchParams.has('version')){
    delayed=true;await new Promise(resolve=>setTimeout(resolve,700));
   }
   await route.continue().catch(()=>{});
  });
  await page.locator('.editor-chapter').filter({hasText:ids[0]}).locator('button').first().click();
  for(let attempt=0;attempt<50 && !delayed;attempt++)await page.waitForTimeout(20);
  assert.equal(delayed,true);
  await page.locator('.editor-chapter').filter({hasText:ids[1]}).locator('button').first().click();
  await page.waitForFunction(marker=>document.querySelector('.tiptap')?.textContent?.trim()===marker,'PASTED '+locale+' '+ids[1]);
  await page.waitForTimeout(900);
  assert.equal((await page.locator('.tiptap').innerText()).trim(),'PASTED '+locale+' '+ids[1]);
  await page.unroute('**/api/admin/chapters?*');
  await page.getByRole('button',{name:locale==='vi'?'Nhập file':'Import files',exact:true}).click();
  await page.getByRole('heading',{name:locale==='vi'?'Nhập nội dung sách':'Import book content',exact:true}).waitFor();
  report.checks.push(locale+' rich paste/save/switch/reload keeps three chapter contents separate; state responses contain no HTML');
  report.checks.push(locale+' stale chapter request is cancelled; import tool loads on demand');
  await page.close();
 }
}catch(e){
 const page=browser?.contexts().flatMap(c=>c.pages()).at(-1);
 report.failure={phase,name:e.name,alerts:page?await page.getByRole('alert').allTextContents():[],detail:String(e.message).replaceAll(password,'[redacted]').slice(0,200)};
 process.exitCode=1;
}
finally{
 if(browser)await browser.close();
 if(uid){
  for(const id of ids){await clean('edition '+id,()=>admin.from('chapter_editions').delete().eq('chapter_id',id));await clean('versions '+id,()=>admin.from('chapter_versions').delete().eq('chapter_id',id));await clean('chapter '+id,()=>admin.from('chapters').delete().eq('id',id));}
  await clean('membership',()=>admin.from('members').delete().eq('user_id',uid));await clean('Auth user',()=>admin.auth.admin.deleteUser(uid));
 }
 report.success=!report.failure&&report.cleanup.every(x=>x.ok);
 if(!report.success)process.exitCode=1;
 await mkdir(new URL('../verification',import.meta.url),{recursive:true});
 await writeFile(new URL('../verification/editor-switch-latest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}

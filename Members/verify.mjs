import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const directory = path.dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(directory, 'data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(directory, 'data-policy.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(directory, 'app.js'), 'utf8'), context);
const data = context.window.MEMBER_DATA;
const {buildMembers, filterMembers} = context.MemberDirectory;
const members = buildMembers(data);
assert.equal(data.records.length, 587);
assert.equal(data.meta.removedVersionCount,10);
assert(data.records.every(record=>!context.MemberPolicy.isExcluded(record.version)));
assert.equal(new Set(data.records.map(record => record.id)).size, data.records.length);
assert.equal(members.reduce((sum,member) => sum + member.records.length,0), data.records.length);
assert.equal(members.filter(member => !member.account && !member.isOwner).length, data.records.filter(record => !record.account && !context.MemberPolicy.isOwnerRecord(record)).length);
const owner = members.find(member=>member.isOwner);
assert.equal(members.filter(member=>member.isOwner).length,1);
assert.equal(owner.displayName,'木木（本人）');
assert.equal(owner.records.length,32);
assert.equal(owner.games.length,5);
assert(owner.records.every(record=>context.MemberPolicy.isOwnerRecord(record)));
for (const name of ['菲蕾德翠卡','海獺君','木木','ムム','무무','일월']) assert(owner.records.some(record=>record.name===name));
assert.equal(owner.records.find(record=>record.id==='朱紫-2').role,'本人');
assert.equal(owner.records.find(record=>record.id==='朱紫-2').originalRole,'胖丁');
assert(context.MemberPolicy.isOwnerRecord({name:'另一個名字',role:'胖丁'}));
assert(!context.MemberPolicy.isOwnerRecord({name:'胖丁',role:'客人'}));
assert.equal(context.MemberPolicy.applyOwnership({name:'另一個名字',role:'胖丁'}).role,'本人');
for (const account of ['皮伊主機','本帳','胖丁','GO']) assert(filterMembers(members,{query:account}).some(member=>member.isOwner));
assert.equal(data.records.filter(record=>!record.account && !context.MemberPolicy.isOwnerRecord(record)).length,9);
for (const [name,account,count] of [['Suisei','Suisei Lin',2],['幻亦玉','ortiz55',2]]) {
  const member = members.find(member=>member.account===account);
  assert.equal(member.records.length,count);
  assert(member.records.every(record=>record.name===name));
  assert.equal(filterMembers(members,{query:account}).length,1);
  assert.equal(filterMembers(members,{query:name}).length,1);
}
assert.equal(context.MemberPolicy.applyOwnership({name:'Suisei',account:'another-account'}).account,'another-account');
assert(data.records.some(record => record.internalId.startsWith('0')));
assert(data.records.some(record => record.trainerId.startsWith('0')));
assert(data.records.every(record => data.categories.includes(record.category)));
assert(!data.categories.includes('阿爾'));
assert.equal(data.records.filter(record=>record.category==='阿爾宙斯').length,18);
assert(data.records.filter(record=>record.category==='阿爾宙斯').every(record=>record.version==='阿爾宙斯'));
assert.equal(context.MemberPolicy.applyOwnership({category:'阿爾',version:''}).version,'阿爾宙斯');
assert.equal(context.MemberPolicy.applyOwnership({category:'阿爾',version:''}).category,'阿爾宙斯');
assert(!/密碼|password/i.test(JSON.stringify(data.records)));
assert(data.activities.every(activity => members.some(member => member.activities.some(item => item.id === activity.id))));
const example = filterMembers(members, {query:' AA0922988987 '});
assert.equal(example.length,1);
assert(example[0].games.length >= 4);
assert.equal(filterMembers(members,{query:'a-nonexistent-account-xyz123'}).length,0);
assert(filterMembers(members,{crossOnly:true}).every(member => member.games.length>1));
for (const category of data.categories) assert(filterMembers(members,{category}).every(member => member.records.some(record=>record.category===category)));
assert.equal(filterMembers(members,{category:'HOME',version:'盾'}).length,0);
const fixture = {categories:['HOME','朱紫'], activities:[], records:[
  {id:'1',category:'HOME',account:' TestUser\n',name:'同名'},
  {id:'2',category:'朱紫',account:'testuser',name:'同名'},
  {id:'3',category:'朱紫',account:'someone-else',name:'同名'},
  {id:'4',category:'朱紫',account:'',name:'同名'},
  {id:'5',category:'朱紫',account:'',name:'同名'},
]};
const grouped = buildMembers(fixture);
assert.equal(grouped.length,4);
assert.equal(grouped.find(member => member.id==='account:testuser').records.length,2);
assert.equal(filterMembers(grouped,{query:'same',crossOnly:true}).length,0);
console.log(JSON.stringify({records:data.records.length,activities:data.activities.length,profiles:members.length,confirmedMembers:members.filter(m=>m.account||m.isOwner).length,crossGame:members.filter(m=>m.games.length>1).length,unresolved:members.filter(m=>!m.account&&!m.isOwner).length,ownerRecords:owner.records.length,exampleGames:example[0].games}));

if (!process.argv.includes('--browser')) process.exit(0);
const require = createRequire(import.meta.url);
const {chromium} = require('C:/Users/t959/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(directory,'index.html')).href);
  await page.locator('.member-card').first().waitFor();
  assert.equal(await page.locator('.member-card').count(),12);
  await page.locator('[data-member="owner:mumu"]').click();
  assert.equal(await page.locator('#detail-title').textContent(),'木木（本人）');
  assert.equal(await page.locator('#detail .profile-summary .badge').count(),5);
  assert.match(await page.locator('#detail-body').textContent(),/32 筆遊戲角色/);
  for (const name of ['菲蕾德翠卡','海獺君','ムム','무무','일월']) assert((await page.locator('#detail-body').textContent()).includes(name));
  assert.match(await page.locator('#detail-body').textContent(),/皮伊主機/);
  await page.locator('#close-detail').click();
  assert.match(await page.locator('#stats').textContent(),/待確認歸屬9/);
  await page.locator('[data-category="阿爾宙斯"]').click();
  assert.equal(await page.locator('#version option[value="阿爾宙斯"]').count(),1);
  await page.locator('#version').selectOption('阿爾宙斯');
  assert((await page.locator('.member-card').count())>0);
  await page.locator('#reset').click();
  const outputDirectory = process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
  if (outputDirectory) {
    fs.mkdirSync(outputDirectory,{recursive:true});
    await page.screenshot({path:path.join(outputDirectory,'members-desktop.png'),fullPage:true});
  }
  await page.locator('#search').fill('AA0922988987');
  assert.equal(await page.locator('.member-card').count(),1);
  await page.locator('.member-card').click();
  assert(await page.locator('#detail').evaluate(dialog=>dialog.open));
  assert.equal(await page.locator('#detail .detail-section h3').filter({hasText:'朱紫'}).count(),1);
  assert.equal(await page.locator('#detail .detail-section h3').filter({hasText:'劍盾'}).count(),1);
  await page.keyboard.press('Escape');
  await page.locator('[data-category="ZA"]').click();
  await page.locator('.member-card').click();
  assert.equal(await page.locator('#detail .detail-section h3').filter({hasText:'朱紫'}).count(),1);
  await page.locator('#close-detail').click();
  await page.locator('#search').fill('not-an-existing-account-xyz123');
  assert(await page.locator('#empty').isVisible());
  await page.locator('#empty-reset').click();
  await page.locator('#cross-only').check();
  await page.locator('.member-card').first().click();
  assert((await page.locator('#detail .profile-summary .badge').count())>=2);
  await page.locator('#close-detail').click();
  await page.locator('#reset').click();
  // The actual downloadable workbook has a blank entry sheet and must not
  // accidentally import its reference roster or the examples on the guide.
  await page.locator('#import-file').setInputFiles(path.join(directory,'outputs/member-template/會員名單.xlsx'));
  await page.waitForFunction(()=>document.getElementById('import-status').textContent.includes('尚未填寫資料'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mumu-members-imported-v1')||'[]').length),0);
  if (outputDirectory) {
    const valid=path.join(outputDirectory,'import-valid.xlsx');
    const invalid=path.join(outputDirectory,'import-invalid.xlsx');
    if (fs.existsSync(valid)) {
      await page.locator('#import-file').setInputFiles(valid);
      await page.waitForFunction(()=>document.getElementById('import-status').textContent.includes('新增 2 筆'));
      assert.match(await page.locator('#import-status').textContent(),/略過 1 筆完全重複資料、1 筆已移除版本/);
      await page.locator('#search').fill('template_test_member');
      assert.equal(await page.locator('.member-card').count(),1);
      await page.locator('.member-card').click();
      assert.equal(await page.locator('#detail .profile-summary .badge').count(),2);
      assert.match(await page.locator('#detail-body').textContent(),/0001/);
      assert.match(await page.locator('#detail-body').textContent(),/025028/);
      await page.locator('#close-detail').click();
      await page.reload();
      await page.locator('#search').fill('template_test_member');
      assert.equal(await page.locator('.member-card').count(),1);
      await page.locator('#import-file').setInputFiles(valid);
      await page.waitForFunction(()=>document.getElementById('import-status').textContent.includes('新增 0 筆'));
      assert.match(await page.locator('#import-status').textContent(),/略過 3 筆完全重複資料/);
      await page.locator('#import-file').setInputFiles(invalid);
      await page.waitForFunction(()=>document.getElementById('import-status').textContent.includes('尚未匯入'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mumu-members-imported-v1')).length),2);
      // Remove only fixtures from this isolated browser profile before screenshots.
      await page.evaluate(()=>localStorage.removeItem('mumu-members-imported-v1'));
      await page.reload();
    }
  }
  await page.locator('#reset').click();
  await page.locator('#next').click();
  assert.match(await page.locator('#page-info').textContent(),/第 2/);
  await page.locator('#previous').click();
  await page.locator('#nationality').selectOption('JPN');
  assert((await page.locator('.member-card').count())>0);
  await page.locator('#reset').click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.member-card').first().click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#close-detail').click();
  if (outputDirectory) await page.screenshot({path:path.join(outputDirectory,'members-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: search, cross-game details, category, empty state, reset, pagination, filters, Excel import, mobile overflow, no JavaScript errors.');
} finally { await browser.close(); }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './data-policy.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) throw new Error('Usage: node Members/prepare-data.mjs <extracted-workbook.json>');
const source = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
const clean = value => String(value ?? '').trim();
const date = value => /^\d+(\.\d+)?$/.test(value) ? new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000).toISOString().slice(0, 10) : value;
const records = [], activities = [], skipped = [];
const categories = ['HOME', '朱紫', '劍盾', 'ZA', '阿爾宙斯', '珍鑽', '皮伊', 'GO'];
for (const sheet of source.sheets) {
  if (sheet.hidden) continue;
  const header = sheet.rows[0];
  const columns = Object.fromEntries(Object.entries(header.cells).map(([cell, value]) => [clean(value), cell.replace(/\d/g, '')]));
  for (const row of sheet.rows.slice(1)) {
    const get = label => clean(row.cells[`${columns[label]}${row.row}`]);
    const home = sheet.name === 'HOME';
    const record = {
      id: `${sheet.name}-${row.row}`, category: sheet.name,
      internalId: get('里ID'), trainerId: get('表ID'), name: home ? get('ID') : get('名字'),
      gender: get('性別'), version: get('版本'), nationality: get('國籍'), role: get('身分'),
      account: home ? get('蝦皮客人') : get('帳號'), notes: get('備註'),
      method: get('方式'), channel: get('渠道'), contact: get('稱謂'), date: date(get('日期')),
      email: get('信箱'), source: sheet.name, row: row.row,
    };
    // Decorative rows are not trainer IDs. Preserve original digit widths as text.
    if (record.internalId && !/^\d+$/.test(record.internalId)) {
      skipped.push({ source: sheet.name, row: row.row, reason: '分隔線' }); continue;
    }
    if (!record.name && !record.account && !record.trainerId) {
      skipped.push({ source: sheet.name, row: row.row, reason: '無會員欄位' }); continue;
    }
    if (MemberPolicy.isExcluded(record.version)) {
      skipped.push({source: sheet.name, row: row.row, reason: '依指定版本移除', version: record.version}); continue;
    }
    if (sheet.name === '皮伊&GO') record.category = record.version.toUpperCase() === 'GO' ? 'GO' : '皮伊';
    else if (record.version.toUpperCase() === 'GO') record.category = 'GO';
    records.push(MemberPolicy.applyOwnership(record));
  }
}
for (const sheet of source.sheets.filter(s => s.hidden && s.name !== '寶可夢練怪')) {
  const header = sheet.rows.find(row => Object.values(row.cells).some(value => ['帳號', 'IG帳號'].includes(clean(value))));
  if (!header) continue;
  const columns = Object.fromEntries(Object.entries(header.cells).map(([cell, value]) => [clean(value), cell.replace(/\d/g, '')]));
  for (const row of sheet.rows.filter(row => row.row > header.row)) {
    const get = label => clean(row.cells[`${columns[label]}${row.row}`]);
    const account = get('帳號'), ig = get('IG帳號');
    if (!account && !ig) continue;
    const fields = {};
    for (const label of Object.keys(columns)) { const value = get(label); if (value) fields[label] = label === '時間' ? date(value) : value; }
    activities.push({id: `${sheet.name}-${row.row}`, source: sheet.name, row: row.row, accounts: [...new Set([account, ig].filter(Boolean))], fields});
  }
}
const data = { categories, records, activities, meta: { source: 'Poke訂單.xlsx', recordCount: records.length, activityCount: activities.length, skipped, excludedVersions: MemberPolicy.excludedVersions, removedVersionCount: skipped.filter(item=>item.reason==='依指定版本移除').length, excludedSheets: ['寶可夢練怪'], grouping: '帳號去除頭尾空白、忽略大小寫；空帳號各自保留', credentialsExcluded: true } };
fs.writeFileSync(path.join(directory, 'data.js'), `/* Generated from the supplied workbook. Passwords are excluded. */\nwindow.MEMBER_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};\n`);
console.log(JSON.stringify({records: records.length, activities: activities.length, skipped, categories: Object.fromEntries(categories.map(c => [c, records.filter(r => r.category === c).length]))}, null, 2));

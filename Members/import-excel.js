(() => {
  'use strict';
  const MAX_FILE = 10 * 1024 * 1024, MAX_XML = 24 * 1024 * 1024;
  const decoder = new TextDecoder();
  async function unzip(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--) if (view.getUint32(end, true) === 0x06054b50) break;
    if (end < 0 || view.getUint32(end,true) !== 0x06054b50) throw new Error('檔案不是有效的 .xlsx，請使用下載的 Excel 名單。');
    const entries = new Map();
    let offset = view.getUint32(end + 16, true), totalSize = 0;
    for (let index = 0; index < view.getUint16(end + 10, true); index++) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Excel 壓縮內容損毀。');
      const method = view.getUint16(offset + 10, true), size = view.getUint32(offset + 20, true), unpacked = view.getUint32(offset + 24, true);
      const nameSize = view.getUint16(offset + 28,true), extraSize = view.getUint16(offset + 30,true), commentSize = view.getUint16(offset + 32,true);
      const name = decoder.decode(bytes.subarray(offset+46,offset+46+nameSize));
      const local = view.getUint32(offset+42,true);
      if (/^xl\/.*\.xml$/.test(name)) {
        totalSize += unpacked;
        if (totalSize > MAX_XML) throw new Error('Excel 內容過大，請將新增名單分成較小的檔案。');
        entries.set(name, {method,size,unpacked,local});
      }
      if (name === 'xl/_rels/workbook.xml.rels') entries.set(name,{method,size,unpacked,local});
      offset += 46 + nameSize + extraSize + commentSize;
    }
    return async name => {
      const entry = entries.get(name);
      if (!entry) return null;
      const start = entry.local + 30 + view.getUint16(entry.local+26,true) + view.getUint16(entry.local+28,true);
      let content = bytes.subarray(start,start+entry.size);
      if (entry.method === 8) {
        const stream = new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        content = new Uint8Array(await new Response(stream).arrayBuffer());
      } else if (entry.method !== 0) throw new Error('無法讀取此 Excel 的壓縮格式，請以一般 .xlsx 格式儲存。');
      if (content.length !== entry.unpacked || content.length > MAX_XML) throw new Error('Excel 內容不完整或過大。');
      const xml = new DOMParser().parseFromString(decoder.decode(content),'application/xml');
      if (xml.getElementsByTagName('parsererror').length) throw new Error('Excel 內容無法解析。');
      return xml;
    };
  }
  const nodes = (element, tag) => [...element.getElementsByTagNameNS('*',tag)];
  const text = (element, tag) => nodes(element,tag).map(node=>node.textContent).join('');
  async function read(file, categories) {
    if (file.size > MAX_FILE) throw new Error('請匯入 10 MB 以下的 .xlsx 名單。');
    const xml = await unzip(await file.arrayBuffer());
    const book = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels');
    if (!book || !rels) throw new Error('找不到 Excel 工作表。');
    const sheet = nodes(book,'sheet').find(sheet=>sheet.getAttribute('name')==='新增人員');
    if (!sheet) throw new Error('找不到「新增人員」工作表，請下載網頁提供的 Excel 名單填寫。');
    const rid = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const relation = nodes(rels,'Relationship').find(rel=>rel.getAttribute('Id')===rid);
    if (!relation) throw new Error('找不到「新增人員」的內容。');
    const target = relation.getAttribute('Target');
    const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//,'')}`;
    const content = await xml(sheetPath);
    if (!content) throw new Error('「新增人員」內容遺失。');
    const shared = await xml('xl/sharedStrings.xml');
    const strings = shared ? nodes(shared,'si').map(si=>text(si,'t')) : [];
    const styles = await xml('xl/styles.xml');
    const formats = new Map(styles ? nodes(styles,'numFmt').map(fmt=>[fmt.getAttribute('numFmtId'),fmt.getAttribute('formatCode')]) : []);
    const xfs = styles ? nodes(styles,'cellXfs').flatMap(group=>nodes(group,'xf')) : [];
    const rows = nodes(content,'row').map(row => {
      const values = {};
      for (const cell of nodes(row,'c')) {
        const type = cell.getAttribute('t');
        if (nodes(cell,'f').length) { values[cell.getAttribute('r').replace(/\d/g,'')] = {formula:true}; continue; }
        let value = type === 'inlineStr' ? text(cell,'t') : text(cell,'v');
        if (type === 's') value = strings[Number(value)] ?? '';
        if (!type || type === 'n') {
          const format = formats.get(xfs[Number(cell.getAttribute('s')||0)]?.getAttribute('numFmtId'));
          if (/^0+$/.test(format || '') && /^\d+$/.test(value)) value = value.padStart(format.length,'0');
        }
        values[cell.getAttribute('r').replace(/\d/g,'')] = value.trim();
      }
      return {number:Number(row.getAttribute('r')),values};
    });
    const header = rows.find(row=>Object.values(row.values).includes('分類') && Object.values(row.values).includes('帳號'));
    if (!header) throw new Error('欄位格式不符，請保留範本中的欄位名稱。');
    const columns = Object.fromEntries(Object.entries(header.values).map(([column,label])=>[label,column]));
    for (const label of ['分類','帳號','名字']) if (!columns[label]) throw new Error(`名單缺少「${label}」欄。`);
    const records = [], errors = [];
    let excluded = 0;
    for (const row of rows.filter(row=>row.number>header.number)) {
      const values = Object.fromEntries(MemberPolicy.fields.map(([field,label])=>[field,row.values[columns[label]] ?? '']));
      if (!Object.values(values).some(Boolean)) continue;
      const error = message => errors.push(`第 ${row.number} 列：${message}`);
      if (Object.values(values).some(value=>typeof value==='object')) { error('請輸入文字或數值，不可使用公式。'); continue; }
      if (MemberPolicy.isExcluded(values.version)) { excluded++; continue; }
      Object.assign(values,MemberPolicy.normalizeGame(values));
      if (!categories.includes(values.category)) error('分類須為 HOME、朱紫、劍盾、ZA、阿爾宙斯、珍鑽、皮伊或 GO。');
      if (!values.account || !values.name) error('請填寫帳號與名字。');
      for (const field of ['internalId','trainerId']) if (values[field] && !/^\d+$/.test(values[field])) error(`${field==='internalId'?'里ID':'表ID'}只能填數字，請以文字格式保留前導零。`);
      if (values.gender && !['♂','♀'].includes(values.gender)) error('性別請選擇 ♂ 或 ♀，也可以留空。');
      if (values.date && /^\d+(\.\d+)?$/.test(values.date)) {
        const timestamp = Date.UTC(1899,11,30)+Number(values.date)*86400000;
        if (Number.isFinite(timestamp) && timestamp>=0 && timestamp<8640000000000000) values.date = new Date(timestamp).toISOString().slice(0,10);
        else error('日期無效。');
      }
      if (values.date && (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(Date.parse(values.date)) || new Date(values.date).toISOString().slice(0,10)!==values.date)) error('日期請填 YYYY-MM-DD。');
      records.push(MemberPolicy.applyOwnership({...values,source:`${file.name}／新增人員`,row:row.number}));
    }
    if (errors.length) throw new Error(`尚未匯入，請先修正以下欄位：\n${errors.slice(0,8).join('\n')}${errors.length>8 ? `\n另有 ${errors.length-8} 項錯誤。` : ''}`);
    if (!records.length && !excluded) throw new Error('「新增人員」尚未填寫資料。現有名單與填寫說明不會重複匯入。');
    return {records,excluded};
  }
  globalThis.MemberExcel = {read};
})();

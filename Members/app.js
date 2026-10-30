/* No network requests: the prototype works when index.html is opened directly. */
(() => {
  'use strict';
  const normalize = value => String(value ?? '').trim().toLocaleLowerCase('en-US');
  const unique = values => [...new Set(values.filter(Boolean))];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function buildMembers(data) {
    const map = new Map();
    function ensure(key, account) {
      if (!map.has(key)) map.set(key, {id:key, account, isOwner:key==='owner:mumu', records:[], activities:[]});
      return map.get(key);
    }
    for (const record of data.records) {
      const owner = MemberPolicy.isOwnerRecord(record);
      const key = owner ? 'owner:mumu' : record.account ? `account:${normalize(record.account)}` : `unlinked:${record.id}`;
      ensure(key, owner ? '' : record.account).records.push(record);
    }
    const accountMembers = new Map();
    for (const member of map.values()) for (const account of unique(member.records.map(record=>normalize(record.account)).filter(Boolean))) {
      if (!accountMembers.has(account)) accountMembers.set(account,[]);
      accountMembers.get(account).push(member);
    }
    for (const activity of data.activities) {
      const matches = unique(activity.accounts.flatMap(account => accountMembers.get(normalize(account)) || [map.get(`account:${normalize(account)}`)]).filter(Boolean));
      if (matches.length) for (const member of matches) member.activities.push(activity);
      else ensure(`account:${normalize(activity.accounts[0])}`, activity.accounts[0]).activities.push(activity);
    }
    return [...map.values()].map(member => {
      member.games = data.categories.filter(category => member.records.some(record => record.category === category));
      member.names = unique(member.records.map(record => record.name));
      member.displayName = member.isOwner ? '木木（本人）' : member.account || member.names[0] || '未命名角色';
      member.searchText = normalize([member.displayName, member.account, ...member.records.flatMap(record => Object.values(record)), ...member.activities.flatMap(activity => [activity.source, ...Object.values(activity.fields)])].join(' '));
      return member;
    });
  }
  function filterMembers(members, filters) {
    const words = normalize(filters.query).split(/\s+/).filter(Boolean);
    return members.filter(member => {
      if (filters.crossOnly && member.games.length < 2) return false;
      if (!words.every(word => member.searchText.includes(word))) return false;
      const fields = ['version','nationality','role','gender'];
      if (!filters.category && !fields.some(field => filters[field])) return true;
      return member.records.some(record => (!filters.category || record.category === filters.category) && fields.every(field => !filters[field] || record[field] === filters[field]));
    }).sort((a,b) => {
      if (filters.sort === 'account') return a.displayName.localeCompare(b.displayName, 'zh-Hant');
      if (filters.sort === 'records') return b.records.length - a.records.length || b.games.length - a.games.length;
      return b.games.length - a.games.length || b.records.length - a.records.length || a.account.localeCompare(b.account, 'zh-Hant');
    });
  }
  globalThis.MemberDirectory = {normalize, buildMembers, filterMembers, escapeHtml};
  if (typeof document === 'undefined') return;
  const data = window.MEMBER_DATA;
  if (!data) { document.getElementById('members').textContent = '無法讀取會員資料，請確認 data.js 與網頁位於同一個資料夾。'; return; }
  data.records = data.records.filter(record=>!MemberPolicy.isExcluded(record.version)).map(MemberPolicy.applyOwnership);
  const storageKey = 'mumu-members-imported-v1';
  let imported = [], storageMessage = '';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('資料格式錯誤');
    imported = saved.filter(record=>record && typeof record==='object' && typeof record.account==='string' && typeof record.name==='string' && !MemberPolicy.isExcluded(record.version)).map(MemberPolicy.applyOwnership).filter(record=>data.categories.includes(record.category));
    const known = new Set(data.records.map(MemberPolicy.fingerprint));
    imported = imported.filter(record=>{const key=MemberPolicy.fingerprint(record);if(known.has(key))return false;known.add(key);return true;});
    data.records.push(...imported);
    if (imported.length) storageMessage = `已載入此瀏覽器儲存的 ${imported.length} 筆新增角色。`;
  } catch { storageMessage = '此瀏覽器的新增資料無法讀取或無法使用儲存空間；原有名單仍可查詢。'; }
  let members = buildMembers(data), byId = new Map(members.map(member => [member.id, member]));
  const $ = id => document.getElementById(id), e = escapeHtml;
  let category = '', page = 1, lastTrigger = null;
  const pageSize = 12;
  const filters = () => ({query:$('search').value, category, version:$('version').value, nationality:$('nationality').value, role:$('role').value, gender:$('gender').value, crossOnly:$('cross-only').checked, sort:$('sort').value});
  const badge = game => `<span class="badge game-${e(game)}">${e(game)}</span>`;
  const countLabel = number => number.toLocaleString('zh-TW');
  function populateFilters() {
    for (const [field,label] of [['version','版本'],['nationality','國籍'],['role','身分']]) {
      const selected = $(field).value;
      const values = unique(data.records.filter(record => !category || record.category === category).map(record => record[field])).sort((a,b) => a.localeCompare(b,'zh-Hant'));
      $(field).innerHTML = `<option value="">全部${label}</option>` + values.map(value => `<option value="${e(value)}">${e(value)}</option>`).join('');
      $(field).value = values.includes(selected) ? selected : '';
    }
  }
  function renderNav() {
    const initials = ['全','H','朱','劍','Z','阿','珍','皮','G'];
    $('category-nav').innerHTML = ['', ...data.categories].map((value,index) => `<button type="button" class="nav-button ${category === value ? 'active' : ''}" data-category="${e(value)}" aria-pressed="${category === value}"><span class="nav-icon">${initials[index]}</span>${e(value || '全部會員')}<span class="nav-count">${countLabel(value ? members.filter(member => member.games.includes(value)).length : members.length)}</span></button>`).join('');
  }
  function renderStats() {
  const stats = [
    ['已歸屬會員', members.filter(member => member.account || member.isOwner).length, '組', '♙'],
    ['遊戲角色紀錄', data.records.length, '筆', '▤'],
    ['跨遊戲會員', members.filter(member => member.games.length > 1).length, '組', '⇄'],
    ['待確認歸屬', data.records.filter(record => !record.account && !MemberPolicy.isOwnerRecord(record)).length, '筆', '◌'],
  ];
  $('stats').innerHTML = stats.map(([label,value,unit,icon]) => `<article class="stat"><div><span class="stat-label">${label}</span><strong>${countLabel(value)}<small>${unit}</small></strong></div><span class="stat-icon" aria-hidden="true">${icon}</span></article>`).join('');
  }
  function render() {
    const results = filterMembers(members, filters());
    const pages = Math.max(1, Math.ceil(results.length / pageSize));
    page = Math.min(page, pages);
    $('view-title').textContent = category ? `${category} 會員` : '全部會員';
    $('view-subtitle').textContent = category ? '開啟會員，查看該帳號所有遊戲的資料' : `8 大遊戲分類 · ${data.activities.length} 筆補充活動紀錄`;
    $('result-count').innerHTML = `找到 <b>${countLabel(results.length)}</b> 組會員資料 <span>／ ${countLabel(members.length)} 組</span>`;
    $('members').innerHTML = results.slice((page-1)*pageSize, page*pageSize).map((member,index) => {
      const title = member.displayName;
      const avatar = [...title.replace(/[^\p{L}\p{N}]/gu,'')].slice(0,2).join('').toUpperCase() || '?';
      const subtitle = member.isOwner ? '本人 · 已確認歸屬' : !member.account ? '待確認歸屬 · 獨立保留' : member.records.length ? '會員帳號' : '活動紀錄帳號';
      const description = member.names.length ? member.names.join('、') : unique(member.activities.map(activity => activity.fields['IG名稱']).filter(Boolean)).join('、') || '尚無遊戲角色資料';
      return `<button type="button" class="member-card" data-member="${e(member.id)}" aria-label="查看 ${e(title)} 的全部資料"><div class="card-top"><span class="avatar tone-${index%4}" aria-hidden="true">${e(avatar)}</span><div class="account-wrap"><span class="account" title="${e(title)}">${e(title)}</span><span class="member-label">${subtitle}</span></div><span class="arrow" aria-hidden="true">↗</span></div><p class="names">${e(description)}</p><div class="badges">${member.games.map(badge).join('') || '<span class="badge">補充活動</span>'}</div><div class="card-foot"><span>${member.records.length} 筆角色${member.activities.length ? ` · ${member.activities.length} 筆活動` : ''}</span><span class="${member.games.length > 1 ? 'cross' : ''}">${member.games.length > 1 ? `跨 ${member.games.length} 個遊戲` : '查看資料 →'}</span></div></button>`;
    }).join('');
    $('empty').hidden = results.length > 0;
    $('page-info').textContent = results.length ? `第 ${page} / ${pages} 頁 · 每頁 ${pageSize} 組` : '0 筆結果';
    $('previous').disabled = page === 1;
    $('next').disabled = page === pages;
  }
  function reset() {
    category = ''; page = 1;
    $('search-form').reset();
    for (const field of ['version','nationality','role','gender']) $(field).value = '';
    $('cross-only').checked = false; $('sort').value = 'games';
    populateFilters(); renderNav(); render();
  }
  function showMember(id, trigger) {
    const member = byId.get(id);
    if (!member) return;
    lastTrigger = trigger;
    $('detail-title').textContent = member.isOwner ? member.displayName : member.account || `${member.names[0] || '未命名角色'}（待確認歸屬）`;
    const profileNote = member.isOwner ? `已由本人確認：${MemberPolicy.ownerNames.map(name=>`「${name}」`).join('、')}與原身分為「胖丁」的紀錄，均屬於同一人。胖丁的身分已改為「本人」，原始帳號與角色 ID 均保留。` : member.account ? '以下顯示此帳號的全部資料，包含本次篩選以外的遊戲。其他會員不會僅因角色同名而自動合併。' : '原始資料未提供帳號，此筆獨立保留，尚未與其他同名角色建立關聯。';
    let html = `<div class="profile-summary">${member.games.map(badge).join('')}<span>${member.records.length} 筆遊戲角色 · ${member.activities.length} 筆活動紀錄</span>${member.account ? '<button class="copy-button" type="button" id="copy-account">複製帳號</button>' : ''}</div><p class="profile-note">${profileNote}</p>`;
    for (const game of member.games) {
      const records = member.records.filter(record => record.category === game);
      const home = game === 'HOME';
      const columns = home ? [['name','名字'],['method','方式'],['channel','渠道'],['contact','聯絡稱呼'],['date','日期']] : [['internalId','里ID'],['trainerId','表ID'],['name','名字'],['gender','性別'],['version','版本'],['nationality','國籍'],['role','身分']];
      html += `<section class="detail-section"><h3>${e(game)} <span class="source-tag">${records.length} 筆</span></h3><div class="table-scroll"><table><thead><tr>${columns.map(([,label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${records.map(record => `<tr>${columns.map(([field]) => `<td>${e(record[field]) || '—'}</td>`).join('')}</tr><tr class="note-row"><td colspan="${columns.length}">${record.notes ? `備註：${e(record.notes).replace(/\n/g,'<br>')}<br>` : ''}${record.email ? `信箱：${e(record.email)}<br>` : ''}${record.account ? `帳號：${e(record.account)}　` : ''}<span class="source-tag">來源：${e(record.source)} · 第 ${record.row} 列</span></td></tr>`).join('')}</tbody></table></div></section>`;
    }
    if (member.activities.length) html += `<section class="detail-section"><h3>相關活動紀錄</h3>${member.activities.map(activity => `<article class="activity"><strong>${e(activity.source)}</strong><span class="source-tag">第 ${activity.row} 列</span><p>${Object.entries(activity.fields).map(([label,value]) => `${e(label)}：${e(value)}`).join('　／　')}</p></article>`).join('')}<p class="profile-note">活動依原表的帳號或 IG 帳號關聯，保留原始紀錄；活動紀錄中的不同帳號尚未自動合併。</p></section>`;
    $('detail-body').innerHTML = html;
    const copy = $('copy-account');
    if (copy) copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(member.account); copy.textContent = '已複製'; }
      catch { copy.textContent = '請選取上方帳號複製'; }
    });
    $('detail').showModal();
    $('detail').scrollTop = 0;
  }
  $('category-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-category]'); if (!button) return;
    category = button.dataset.category; page = 1; populateFilters(); renderNav(); render();
  });
  $('members').addEventListener('click', event => { const button = event.target.closest('[data-member]'); if (button) showMember(button.dataset.member, button); });
  $('search-form').addEventListener('submit', event => { event.preventDefault(); page = 1; render(); });
  $('search').addEventListener('input', () => { page = 1; render(); });
  for (const id of ['version','nationality','role','gender','cross-only','sort']) $(id).addEventListener('change', () => { page = 1; render(); });
  for (const id of ['reset','empty-reset']) $(id).addEventListener('click', reset);
  for (const [id,offset] of [['previous',-1],['next',1]]) $(id).addEventListener('click', () => { page += offset; render(); $('workspace')?.scrollIntoView(); });
  $('close-detail').addEventListener('click', () => $('detail').close());
  $('detail').addEventListener('close', () => lastTrigger?.focus());
  $('detail').addEventListener('click', event => {
    if (event.target !== $('detail')) return;
    const rect = $('detail').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('detail').close();
  });
  document.addEventListener('keydown', event => { if (event.key === '/' && !$('detail').open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); $('search').focus(); } });
  $('import-status').textContent = storageMessage;
  $('import-excel').addEventListener('click', ()=>$('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const button = $('import-excel'), status = $('import-status');
    button.disabled = true; status.textContent = '正在讀取 Excel…'; status.classList.remove('import-error');
    try {
      const result = await MemberExcel.read(file,data.categories);
      const known = new Set(data.records.map(MemberPolicy.fingerprint));
      const added = [];
      for (const record of result.records) {
        const signature = MemberPolicy.fingerprint(record);
        if (known.has(signature)) continue;
        known.add(signature);
        added.push({...record,id:`import:${crypto.randomUUID()}`});
      }
      // Save first: quota or browser storage failures must not leave a partial import.
      if (added.length) {
        const next = [...imported,...added];
        try { localStorage.setItem(storageKey,JSON.stringify(next)); }
        catch { throw new Error('無法儲存新增名單，可能是瀏覽器禁止本機儲存或空間不足。本次未匯入，請保留 Excel 並更換瀏覽器重試。'); }
        imported = next; data.records.push(...added);
        members = buildMembers(data); byId = new Map(members.map(member=>[member.id,member]));
        reset(); renderStats();
      }
      status.textContent = `匯入完成：新增 ${added.length} 筆，略過 ${result.records.length-added.length} 筆完全重複資料${result.excluded ? `、${result.excluded} 筆已移除版本` : ''}。新增名單已儲存在目前瀏覽器。`;
    } catch(error) { status.textContent = error.message || 'Excel 無法讀取，請使用網頁提供的範本。'; status.classList.add('import-error'); }
    finally { button.disabled = false; event.target.value = ''; }
  });
  populateFilters(); renderNav(); renderStats(); render();
})();

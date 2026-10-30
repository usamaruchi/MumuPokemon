(() => {
  const excludedVersions = ['太陽', '白金', '究極日', '究極月', '城都', '豐原', '關都', 'Y'];
  const isExcluded = version => excludedVersions.includes(String(version ?? '').trim().toUpperCase());
  const fields = [['category','分類'],['account','帳號'],['internalId','里ID'],['trainerId','表ID'],['name','名字'],['gender','性別'],['version','版本'],['nationality','國籍'],['role','身分'],['notes','備註'],['method','方式'],['channel','渠道'],['contact','聯絡稱呼'],['date','日期'],['email','信箱']];
  const fingerprint = record => JSON.stringify(fields.map(([field]) => field === 'account' ? String(record[field] ?? '').trim().toLowerCase() : String(record[field] ?? '').trim()));
  // Explicit ownership rules confirmed by the user; ordinary names remain separate.
  const ownerNames = ['菲蕾德翠卡', '海獺君', '木木', 'ムム', '무무', '일월'];
  const isOwnerRecord = record => ownerNames.includes(String(record.name ?? '').trim()) || String(record.role ?? '').trim() === '胖丁' || record.originalRole === '胖丁';
  const confirmedAccounts = {'Suisei':'Suisei Lin', '幻亦玉':'ortiz55'};
  const normalizeGame = record => ['阿爾','阿爾宙斯'].includes(record.category) ? {...record, category:'阿爾宙斯', version:'阿爾宙斯'} : record;
  const applyOwnership = record => {
    let result = normalizeGame(record);
    if (String(record.role ?? '').trim() === '胖丁') result = {...result, role:'本人', originalRole:'胖丁'};
    const account = confirmedAccounts[String(record.name ?? '').trim()];
    if (!String(record.account ?? '').trim() && account) result = {...result, account, originalAccount:record.account ?? ''};
    return result;
  };
  globalThis.MemberPolicy = {excludedVersions, isExcluded, fields, fingerprint, ownerNames, isOwnerRecord, normalizeGame, applyOwnership};
})();

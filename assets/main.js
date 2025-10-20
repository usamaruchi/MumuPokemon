// ⚙️ Supabase 設定
const SUPABASE_URL = 'https://fsglwszioporinflhcuk.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZ2x3c3ppb3BvcmluZmxoY3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzI5ODEsImV4cCI6MjA3NjA0ODk4MX0.dhaiVLec5_C5qDzWG3GJ0bbXKrH0E0QyQUN8Q9fcCGk';
const TABLE = 'random_logs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 🎯 群組資料
const groups = {
  A: ['皮卡丘', 'A2'],
  B: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
  C: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12'],
};

const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const codeBtn = document.getElementById('code-btn');
const codeInput = document.getElementById('code-input');
const codeStatus = document.getElementById('code-status');
const generateBtn = document.getElementById('generate-btn');
let redeemedCode = null;

// 顯示群組項目
function renderGroups() {
  document.getElementById('listA').innerHTML = groups.A.map((i) => `<li>${i}</li>`).join('');
  document.getElementById('listB').innerHTML = groups.B.map((i) => `<li>${i}</li>`).join('');
  document.getElementById('listC').innerHTML = groups.C.map((i) => `<li>${i}</li>`).join('');
}
renderGroups();

// 🎰 抽獎機率邏輯
function chooseGroup() {
  const rand = Math.random();
  if (rand < 0.15) return 'A';
  else if (rand < 0.5) return 'B';
  else return 'C';
}

// 🧹 重置整體狀態（可再次抽獎）
function resetAll() {
  redeemedCode = null;
  codeInput.value = '';
  codeInput.disabled = false;
  codeBtn.disabled = false;
  generateBtn.classList.add('disabled');
  resultDiv.innerHTML = '';
  statusDiv.textContent = '';
  codeStatus.textContent = '';
}

// === 抽獎代碼驗證 ===
codeBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  if (!code) {
    codeStatus.textContent = '請輸入抽獎代碼。';
    codeStatus.style.color = 'red';
    return;
  }

  codeStatus.textContent = '驗證中...';
  codeStatus.style.color = '#555';

  const { data, error } = await supabase.rpc('redeem_code', { p_code: code });

  if (error) {
    console.error(error);
    codeStatus.textContent = '⚠️ 驗證失敗，請稍後再試。';
    codeStatus.style.color = 'red';
    return;
  }

  const ok = data === true || (Array.isArray(data) && data[0] === true);
  if (ok) {
    redeemedCode = code;
    codeStatus.textContent = '✅ 驗證成功！代碼已啟用抽獎資格。';
    codeStatus.style.color = 'green';
    generateBtn.classList.remove('disabled');
    codeInput.disabled = true;
    codeBtn.disabled = true;
  } else {
    codeStatus.textContent = '❌ 代碼不存在或已使用過。';
    codeStatus.style.color = 'red';
  }
});

// === 抽獎 ===
generateBtn.addEventListener('click', async () => {
  if (generateBtn.classList.contains('disabled')) {
    statusDiv.textContent = '⚠️ 請先輸入並驗證抽獎代碼。';
    statusDiv.style.color = 'red';
    return;
  }

  statusDiv.textContent = '⏳ 抽獎中...';
  statusDiv.style.color = '#555';

  const chosenGroup = chooseGroup();
  const chosenItem = groups[chosenGroup][Math.floor(Math.random() * groups[chosenGroup].length)];
  resultDiv.innerHTML = `🎯 群組：<b>${chosenGroup}</b>　子項目：<b>${chosenItem}</b>`;

  const { error } = await supabase.from(TABLE).insert([
    {
      group_name: chosenGroup,
      item_name: chosenItem,
      code_used: redeemedCode,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error(error);
    statusDiv.textContent = '⚠️ 資料儲存失敗。';
    statusDiv.style.color = 'red';
  } else {
    statusDiv.textContent = '✅ 抽獎結果已儲存至雲端資料庫！';
    statusDiv.style.color = 'green';
    generateBtn.classList.add('disabled');

    setTimeout(() => {
      alert('🎉 抽獎完成！可以輸入新的抽獎代碼再試一次～');
      resetAll();
    }, 1500);
  }
});

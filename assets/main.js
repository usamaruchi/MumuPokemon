// 🎯 群組資料
const groups = {
  A: ['皮卡丘', 'A2'],
  B: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
  C: [
    'C1',
    'C2',
    'C3',
    'C4',
    'C5',
    'C6',
    'C7',
    'C8',
    'C9',
    'C10',
    'C11',
    'C12',
  ],
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
  document.getElementById('listA').innerHTML = groups.A.map(
    (i) => `<li>${i}</li>`
  ).join('');
  document.getElementById('listB').innerHTML = groups.B.map(
    (i) => `<li>${i}</li>`
  ).join('');
  document.getElementById('listC').innerHTML = groups.C.map(
    (i) => `<li>${i}</li>`
  ).join('');
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

  try {
    const res = await fetch('/api/redeem.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
    });
    const data = await res.json();

    if (data.error) {
      console.error(data.error);
      codeStatus.textContent = '⚠️ 伺服器錯誤，請稍後再試。';
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
  } catch (err) {
    console.error(err);
    codeStatus.textContent = '⚠️ 無法連線至伺服器，請稍後再試。';
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
  const chosenItem =
    groups[chosenGroup][Math.floor(Math.random() * groups[chosenGroup].length)];
  resultDiv.innerHTML = `🎯 群組：<b>${chosenGroup}</b>　子項目：<b>${chosenItem}</b>`;

  try {
    const res = await fetch('/api/save_result.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          group_name: chosenGroup,
          item_name: chosenItem,
          code_used: redeemedCode,
          created_at: new Date().toISOString(),
        },
      ]),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.error(data);
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
  } catch (err) {
    console.error(err);
    statusDiv.textContent = '❌ 連線錯誤，請檢查網路。';
    statusDiv.style.color = 'red';
  }
});

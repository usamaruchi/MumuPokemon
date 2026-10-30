  const SUPABASE_URL = 'https://fsglwszioporinflhcuk.supabase.co';
    const SUPABASE_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZ2x3c3ppb3BvcmluZmxoY3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzI5ODEsImV4cCI6MjA3NjA0ODk4MX0.dhaiVLec5_C5qDzWG3GJ0bbXKrH0E0QyQUN8Q9fcCGk';
    const TABLE = 'random_logs';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let allPrizeData = [];
    let groups = { A: [], B: [], C: [] };
    let currentEvent = "Group1";

    async function loadExcelPrizes() {
      const status = document.getElementById("excel-status");
      try {
        const res = await fetch("assets/prizes.xlsx?_=" + Date.now());
        if (!res.ok) throw new Error("Excel 檔案載入失敗");
        const data = await res.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        allPrizeData = XLSX.utils.sheet_to_json(sheet);

        filterEventData(currentEvent);
        const total = Object.values(groups).flat().length;
        status.textContent = `✅ 已載入 ${total} 筆 (${currentEvent})`;
        status.style.color = "green";
      } catch (err) {
        console.error("❌ Excel 載入失敗：", err);
        document.getElementById("excel-status").textContent = "⚠️ 無法載入 prizes.xlsx";
      }
    }

    function filterEventData(eventName) {
      const filtered = allPrizeData.filter(row => row.event_group === eventName);
      groups = filtered.reduce((acc, row) => {
        const g = row.group_name?.trim();
        const i = row.item_name?.trim();
        if (!g || !i) return acc;
        if (!acc[g]) acc[g] = [];
        acc[g].push(i);
        return acc;
      }, { A: [], B: [], C: [] });
      renderGroups();
    }

    function renderGroups() {
      document.getElementById('listA').innerHTML = (groups.A || []).map(i => `<li>${i}</li>`).join('');
      document.getElementById('listB').innerHTML = (groups.B || []).map(i => `<li>${i}</li>`).join('');
      document.getElementById('listC').innerHTML = (groups.C || []).map(i => `<li>${i}</li>`).join('');
    }

    // 🎛️ 切換活動按鈕
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll('[data-group]').forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll('[data-group]').forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          currentEvent = btn.getAttribute("data-group");
          filterEventData(currentEvent);
          const total = Object.values(groups).flat().length;
          document.getElementById("excel-status").textContent = `✅ 已載入 ${total} 筆 (${currentEvent})`;
        });
      });
    });

    // 🎰 抽獎邏輯
    function chooseGroup() {
      const rand = Math.random();
      if (rand < 0.15) return 'A';
      else if (rand < 0.4) return 'B';
      else return 'C';
    }

    const statusDiv = document.getElementById('status');
    const resultDiv = document.getElementById('result');
    const codeBtn = document.getElementById('code-btn');
    const codeInput = document.getElementById('code-input');
    const codeStatus = document.getElementById('code-status');
    const generateBtn = document.getElementById('generate-btn');
    const recentList = document.getElementById('recent-list');
    let redeemedCode = null;

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

    async function loadRecentDraws() {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, event_group, group_name, item_name, code_used, created_at')
        .order('id', { ascending: false })
        .limit(10);

      if (error) {
        console.error('載入最新抽獎紀錄失敗:', error);
        recentList.innerHTML = '<li style="color:red;">⚠️ 無法載入最新抽獎紀錄</li>';
        return;
      }

      if (!data || data.length === 0) {
        recentList.innerHTML = '<li style="color:#777;">（目前尚無抽獎紀錄）</li>';
        return;
      }

      // 🧩 對照表：英文代號 → 中文名稱
      const groupNames = {
        Group1: '朱紫',
        Group2: '劍盾',
        Group3: '珍鑽',
        Group4: 'ZA'
      };

      recentList.innerHTML = data.map(row => {
        const eventLabel = groupNames[row.event_group] || row.event_group || '朱紫';
        return `
      <li>
        🏷️ <b style="color:#555;">${eventLabel}</b> ｜🎯 <b>${row.group_name}</b> - ${row.item_name}
        <small style="color:#777;">
          (${new Date(row.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })})
        </small>
      </li>`;
      }).join('');
    }


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

    generateBtn.addEventListener('click', async () => {
      if (generateBtn.classList.contains('disabled')) {
        statusDiv.textContent = '⚠️ 請先輸入並驗證抽獎代碼。';
        statusDiv.style.color = 'red';
        return;
      }

      statusDiv.textContent = '⏳ 抽獎中...';
      statusDiv.style.color = '#555';

      const chosenGroup = chooseGroup();
      const list = groups[chosenGroup] || [];
      const chosenItem = list[Math.floor(Math.random() * list.length)];
      resultDiv.innerHTML = `🎯 獎區：<b>${chosenGroup}</b>　寶可夢：<b>${chosenItem}</b>`;

      const { error } = await supabase.from(TABLE).insert([{
        event_group: currentEvent,
        group_name: chosenGroup,
        item_name: chosenItem,
        code_used: redeemedCode,
        created_at: new Date().toISOString(),
      }]);

      if (error) {
        console.error(error);
        statusDiv.textContent = '⚠️ 資料儲存失敗。';
        statusDiv.style.color = 'red';
      } else {
        statusDiv.textContent = '✅ 抽獎結果已記錄！';
        statusDiv.style.color = 'green';
        generateBtn.classList.add('disabled');
        await loadRecentDraws();
        setTimeout(() => {
          alert('🎉 抽獎完成！可以輸入新的抽獎代碼再試一次～');
          resetAll();
        }, 1500);
      }
    });

    // 🚀 初始載入
    loadExcelPrizes();
    loadRecentDraws();
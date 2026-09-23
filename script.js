/**
 * THẮP HƯƠNG - SCRIPT.JS
 * ============================================================
 * CẤU HÌNH – Chỉnh sửa các giá trị dưới đây để tinh chỉnh
 * ============================================================
 */
const CONFIG = {
  // -------------------------------------------------------------------
  // Vị trí BÁT HƯƠNG trên ảnh altar.png (% so với kích thước KHUNG hiển thị)
  //   - Tâm ngang ≈ 50% (chính giữa)
  //   - Miệng bát (viền trên) ≈ 65% từ đỉnh ảnh
  // bowlY là vị trí MIỆNG bát → đáy bó hương sẽ chạm vào đây
  // -------------------------------------------------------------------
  bowlXPercent: 50,    // Tâm ngang bát hương (0=trái, 100=phải)
  bowlYPercent: 58,    // Vị trí MIỆNG bát hương từ đỉnh xuống (%)

  // -------------------------------------------------------------------
  // Kích thước bó hương khi đã cắm (% so với chiều rộng khung bàn thờ)
  // -------------------------------------------------------------------
  incenseWidthPercent: 40,

  // -------------------------------------------------------------------
  // Offset dọc tinh chỉnh vị trí cắm (px)
  //   > 0 → đẩy hương xuống sâu hơn vào bát
  //   < 0 → nâng hương lên cao hơn
  // -------------------------------------------------------------------
  insertOffsetY: 37,

  // -------------------------------------------------------------------
  // Animation timings (ms)
  // -------------------------------------------------------------------
  riseDelay: 200,        // Delay sau khi nhấn nút trước khi hương bay
  riseDuration: 1800,    // Thời gian bay từ dưới lên bàn thờ
  insertDuration: 800,   // Thời gian animation cắm hương
  btnChangeDelay: 600,   // Delay đổi text nút sau khi cắm xong

  // -------------------------------------------------------------------
  // Vị trí xuất phát của hương (trước khi bay lên)
  // -------------------------------------------------------------------
  startXPercent: 50,    // % ngang so với bàn thờ (50 = giữa)
  startYBelowPx: 60,    // px dưới đáy bàn thờ

  // -------------------------------------------------------------------
  // Google Apps Script Web App URL
  // ⚠️ THAY BẰNG URL SAU KHI DEPLOY APPS SCRIPT
  // -------------------------------------------------------------------
  apiUrl: 'https://script.google.com/macros/s/AKfycbzRKrBjfdkcwZ25vzsi56b9IrkpQctfQULJb6I65dM6lJYxsMb7cIIGMgzmAOOSu1C2kA/exec',
};

/* ============================================================
   MERIT API – Giao tiếp với Google Sheets qua Apps Script
   ============================================================ */
const MeritAPI = {
  /** Lấy bảng xếp hạng */
  async getLeaderboard() {
    const res = await fetch(CONFIG.apiUrl);
    const json = await res.json();
    return json.leaderboard || [];
  },

  /** Cộng +1 công đức cho tên, trả về bảng xếp hạng mới */
  async addMerit(name) {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Lỗi ghi dữ liệu');
    return json.leaderboard || [];
  },
};

/* ============================================================
   KHỞI TẠO
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // --- Lấy phần tử DOM ---
  const btn = document.getElementById('btn-incense');
  const btnNote = document.getElementById('btn-note');
  const nameInput = document.getElementById('user-name');
  const altarContainer = document.getElementById('altar-container');
  const incenseEl = document.getElementById('incense');
  const incenseImg = incenseEl.querySelector('img');
  const bgAudio = document.getElementById('bg-audio');
  const altarImgMo = document.getElementById('altar-img');
  const altarDoors = document.getElementById('altar-doors');

  // Merit board DOM
  const meritLoading = document.getElementById('merit-loading');
  const meritTableWrap = document.getElementById('merit-table-wrap');
  const meritTbody = document.getElementById('merit-tbody');
  const meritEmpty = document.getElementById('merit-empty');
  const btnExport = document.getElementById('btn-export');

  // --- State ---
  let isAnimating = false;
  let hasOffered = false;
  let currentName = '';

  /* ----------------------------------------------------------
     MỞ BÀN THỜ KHI VÀO TRANG
  ---------------------------------------------------------- */
  (function openAltarOnLoad() {
    setTimeout(() => {
      if (altarDoors) altarDoors.classList.add('open');
    }, 600);

    setTimeout(() => {
      if (altarDoors) altarDoors.style.display = 'none';
    }, 3000);
  })();

  /* ----------------------------------------------------------
     TẢI BẢNG XẾP HẠNG KHI VÀO TRANG
  ---------------------------------------------------------- */
  loadLeaderboard();

  async function loadLeaderboard(highlightName = null) {
    // Kiểm tra URL đã được cấu hình chưa
    if (!CONFIG.apiUrl || CONFIG.apiUrl.startsWith('PASTE_')) {
      showLeaderboardError('⚠️ Chưa cấu hình API URL. Vui lòng deploy Apps Script.');
      return;
    }

    try {
      meritLoading.hidden = false;
      meritTableWrap.hidden = true;
      meritEmpty.hidden = true;

      const data = await MeritAPI.getLeaderboard();
      renderLeaderboard(data, highlightName);
    } catch (err) {
      console.error('Lỗi tải bảng xếp hạng:', err);
      showLeaderboardError('Không tải được bảng xếp hạng. Vui lòng thử lại.');
    } finally {
      meritLoading.hidden = true;
    }
  }

  function showLeaderboardError(msg) {
    meritLoading.hidden = true;
    meritTableWrap.hidden = true;
    meritEmpty.hidden = false;
    meritEmpty.textContent = msg;
  }

  /* ----------------------------------------------------------
     RENDER BẢNG XẾP HẠNG
  ---------------------------------------------------------- */
  const RANK_ICONS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  /**
   * Format chuỗi thời gian sang định dạng Việt Nam gọn gàng.
   * Đầu vào: chuỗi bất kỳ từ Google Sheets (vd: "9/21/2025, 3:51 PM GMT+0700 (Giờ Đông Dương)")
   * Đầu ra: "21/09/2025 15:51"
   */
  function formatViTime(raw) {
    if (!raw) return '—';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw; // fallback nếu parse thất bại
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return raw;
    }
  }

  function renderLeaderboard(data, highlightName = null) {
    meritTbody.innerHTML = '';

    if (!data || data.length === 0) {
      meritTableWrap.hidden = true;
      meritEmpty.hidden = false;
      meritEmpty.textContent = 'Chưa có ai dâng hương. Hãy là người đầu tiên! 🙏';
      return;
    }

    meritTableWrap.hidden = false;
    meritEmpty.hidden = true;

    data.forEach((row, i) => {
      const rank = i + 1;
      const tr = document.createElement('tr');

      // Classes
      if (rank <= 3) tr.classList.add(`rank-${rank}`);
      if (row.name === currentName) tr.classList.add('current-user');
      if (row.name === highlightName) tr.classList.add('new-entry');

      // Hiển thị icon hoặc số thứ hạng
      const rankDisplay = RANK_ICONS[rank]
        ? `<span class="rank-badge">${RANK_ICONS[rank]}</span>`
        : rank;

      // Format thời gian sang giờ Việt Nam, bỏ phần "(GMT+0700...)"
      const timeDisplay = formatViTime(row.lastTime);

      tr.innerHTML = `
        <td class="col-rank">${rankDisplay}</td>
        <td class="col-name">${escapeHtml(row.name)}</td>
        <td class="col-merit"><span class="merit-num">${row.merit.toLocaleString('vi-VN')}</span></td>
        <td class="col-time">${escapeHtml(timeDisplay)}</td>
      `;
      meritTbody.appendChild(tr);
    });
  }

  /* ----------------------------------------------------------
     VALIDATE TÊN → bật/tắt nút
  ---------------------------------------------------------- */
  nameInput.addEventListener('input', () => {
    const val = nameInput.value.trim();
    const valid = val.length > 0;
    btn.disabled = !valid || isAnimating;

    if (valid && !isAnimating) {
      btnNote.textContent = hasOffered
        ? 'Tiếp tục dâng thêm một nén hương'
        : 'Nhấn để dâng hương';
    } else if (!valid) {
      btnNote.textContent = 'Nhập tên để dâng hương';
    }
  });

  // Enter trong ô tên → nhấn nút
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !btn.disabled) btn.click();
  });

  /* ----------------------------------------------------------
     SỰ KIỆN NHẤN NÚT THẮP HƯƠNG
  ---------------------------------------------------------- */
  btn.addEventListener('click', () => {
    if (isAnimating) return;

    currentName = nameInput.value.trim();
    if (!currentName) return;

    isAnimating = true;
    btn.disabled = true;
    nameInput.disabled = true;

    // Phát nhạc ngay sau user interaction
    playAudio(bgAudio);

    setTimeout(() => runAnimation(), CONFIG.riseDelay);
  });

  /* ----------------------------------------------------------
     ANIMATION CHÍNH (bay lên + cắm hương)
  ---------------------------------------------------------- */
  function runAnimation() {
    // Tính toán tọa độ hoàn toàn bằng % (giúp không bao giờ bị lệch khi zoom)
    const incenseW_pct = CONFIG.incenseWidthPercent;
    const finalLeft_pct = CONFIG.bowlXPercent - (incenseW_pct / 2);

    // offsetPercent: insertOffsetY được chuẩn hóa theo hệ quy chiếu 560px chiều rộng
    // Vì aspect ratio là 3/4, chiều cao tương ứng là 560 / 0.75 = 746.66px
    const offset_pct = (CONFIG.insertOffsetY / 746.66) * 100;
    const finalBottom_pct = (100 - CONFIG.bowlYPercent) - offset_pct;

    const startLeft_pct = CONFIG.startXPercent - (incenseW_pct / 2);

    // Tính chiều cao tạm thời của bó hương theo % so với bàn thờ để tìm điểm bắt đầu (ẩn dưới đáy)
    // Tỉ lệ SVG là getIncenseRatio(). incenseH_pct = incenseW_pct / ratio * (3/4) // quy đổi %width sang %height
    const ratio = getIncenseRatio();
    const incenseH_pct = (incenseW_pct / ratio) * 0.75;
    const startBottom_pct = -incenseH_pct - 20; // Ẩn sâu dưới đáy 20%

    // BƯỚC 1: Đặt vị trí ban đầu (dưới màn hình)
    incenseEl.style.transition = 'none';
    incenseEl.style.display = 'block';
    incenseEl.style.width = `${incenseW_pct}%`;
    incenseEl.style.left = `${startLeft_pct}%`;
    incenseEl.style.top = 'auto'; // Bỏ top
    incenseEl.style.bottom = `${startBottom_pct}%`;
    incenseEl.style.transform = 'rotate(-20deg)';
    incenseEl.style.opacity = '0';
    void incenseEl.offsetHeight;

    // BƯỚC 2: Bay lên
    incenseEl.style.transition = [
      `left      ${CONFIG.riseDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
      `bottom    ${CONFIG.riseDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
      `opacity   500ms ease`,
      `transform ${CONFIG.riseDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
    ].join(', ');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        incenseEl.style.opacity = '1';
        incenseEl.style.left = `${finalLeft_pct}%`;
        // Bay cao hơn miệng bát một chút (5%)
        incenseEl.style.bottom = `${finalBottom_pct + (incenseH_pct * 0.05)}%`;
        incenseEl.style.transform = 'rotate(-6deg)';
      });
    });

    // BƯỚC 3: Cắm hương
    setTimeout(() => {
      incenseEl.style.transition = [
        `transform ${CONFIG.insertDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        `bottom    ${CONFIG.insertDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      ].join(', ');
      incenseEl.style.transform = 'rotate(0deg)';
      incenseEl.style.bottom = `${finalBottom}px`;
    }, CONFIG.riseDuration + 50);

    // BƯỚC 4: Hoàn thành → ghi công đức
    const totalTime = CONFIG.riseDuration + CONFIG.insertDuration + CONFIG.btnChangeDelay;
    setTimeout(async () => {
      btn.textContent = 'Đang ghi công đức...';

      // Chỉ mở lượt tiếp theo sau khi API đã xử lý xong.
      const saved = await saveMeritAndRefresh(currentName);

      isAnimating = false;
      nameInput.disabled = false;
      btn.disabled = nameInput.value.trim().length === 0;

      if (saved) {
        hasOffered = true;
        btn.textContent = 'Thắp thêm 1 nén';
        btn.title = 'Tiếp tục dâng thêm một nén hương.';
        btnNote.textContent = 'Mỗi lần thành tâm là thêm một nén hương';
      } else {
        btn.textContent = 'Thử lại';
        btn.title = 'Chưa ghi được công đức. Vui lòng thử lại.';
        btnNote.textContent = 'Chưa thể ghi công đức, vui lòng thử lại';
      }
    }, totalTime);
  }

  /* ----------------------------------------------------------
     GHI CÔNG ĐỨC + HIỆU ỨNG + CẬP NHẬT BẢNG
  ---------------------------------------------------------- */
  async function saveMeritAndRefresh(name) {
    if (!CONFIG.apiUrl || CONFIG.apiUrl.startsWith('PASTE_')) {
      console.warn('API URL chưa được cấu hình. Bỏ qua ghi dữ liệu.');
      return false;
    }

    try {
      const newData = await MeritAPI.addMerit(name);
      renderLeaderboard(newData, name);
      showMeritFloat();
      return true;

    } catch (err) {
      console.error('Lỗi ghi công đức:', err);
      // Thử load lại bảng
      loadLeaderboard(name);
      return false;
    }
  }

  /* ----------------------------------------------------------
     ANIMATION +1 CÔNG ĐỨC NỔI LÊN
  ---------------------------------------------------------- */
  function showMeritFloat() {
    const el = document.createElement('div');
    el.className = 'merit-float';
    el.textContent = '+1 Công Đức 🙏';

    // Đặt vị trí gần nút
    const btnRect = btn.getBoundingClientRect();
    el.style.top = `${btnRect.top + window.scrollY - 10}px`;

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  /* ----------------------------------------------------------
     XUẤT FILE .TXT
  ---------------------------------------------------------- */
  btnExport.addEventListener('click', async () => {
    btnExport.textContent = '⏳ Đang tải...';
    btnExport.disabled = true;

    try {
      const data = await MeritAPI.getLeaderboard();

      const lines = [
        '════════════════════════════════════════',
        '  BẢNG XẾP HẠNG CÔNG ĐỨC – THẮP HƯƠNG',
        `  Xuất lúc: ${new Date().toLocaleString('vi-VN')}`,
        '════════════════════════════════════════',
        '',
        `${'#'.padEnd(5)} ${'Họ tên'.padEnd(30)} ${'Công đức'.padEnd(12)} Lần cuối`,
        '─'.repeat(72),
      ];

      data.forEach((row, i) => {
        const rank = String(i + 1).padEnd(5);
        const name = row.name.padEnd(30);
        const merit = String(row.merit).padEnd(12);
        lines.push(`${rank} ${name} ${merit} ${row.lastTime}`);
      });

      lines.push('', '─'.repeat(72));
      lines.push(`Tổng số người: ${data.length}`);
      lines.push('Tổng công đức: ' + data.reduce((s, r) => s + r.merit, 0).toLocaleString('vi-VN') + ' nén hương');

      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cong-duc-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      alert('Không tải được dữ liệu. Vui lòng thử lại.');
    } finally {
      btnExport.textContent = '📅 Xuất .txt';
      btnExport.disabled = false;
    }
  });

  /* ----------------------------------------------------------
     PHÁT AUDIO
  ---------------------------------------------------------- */
  function playAudio(audio) {
    if (!audio) return;
    audio.loop = true;
    audio.volume = 0.45;
    audio.play().catch(err => console.warn('Audio autoplay bị chặn:', err.message));
  }

  /* ----------------------------------------------------------
     TỈ LỆ ẢNH HƯƠNG
  ---------------------------------------------------------- */
  function getIncenseRatio() {
    if (incenseImg.naturalWidth && incenseImg.naturalHeight) {
      return incenseImg.naturalWidth / incenseImg.naturalHeight;
    }
    return 0.55; // fallback
  }

  /* ----------------------------------------------------------
     RESIZE: Giữ đúng vị trí hương khi thay đổi kích thước cửa sổ
  ---------------------------------------------------------- */
  window.addEventListener('resize', () => {
    if (!hasOffered) return;

    const incenseW_pct = CONFIG.incenseWidthPercent;
    const finalLeft_pct = CONFIG.bowlXPercent - (incenseW_pct / 2);
    const offset_pct = (CONFIG.insertOffsetY / 746.66) * 100;
    const finalBottom_pct = (100 - CONFIG.bowlYPercent) - offset_pct;

    incenseEl.style.transition = 'none';
    incenseEl.style.width = `${incenseW_pct}%`;
    incenseEl.style.left = `${finalLeft_pct}%`;
    incenseEl.style.top = 'auto'; // Bỏ top để dùng bottom
    incenseEl.style.bottom = `${finalBottom_pct}%`;
    incenseEl.style.transform = 'rotate(0deg)';
  });

  /* ----------------------------------------------------------
     UTILITY: Escape HTML để tránh XSS
  ---------------------------------------------------------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

});


/* ============================================================
   app.js — Main Application Logic
   AkademikAPP · Triesakti Institute of Airlines
   Single-page app with role-based views, activity tracker,
   class checklist, and real-time monitoring dashboard.
   ============================================================ */

'use strict';

// ============================================================
//  APP STATE
// ============================================================
const App = {
  user: null,        // { id, nama, jabatan, status }
  role: null,        // 'admin' | 'staff'
  tab:  null,        // current tab id
  editStaffId: null, // for staff edit modal
  selectedRoom: null, // for checklist
  draftLogs: {},     // dynamic draft categories
  activeCat: null    // active category ID
};

let clockTimer = null;

const SLOT_CATEGORIES = {
  '05:00': ['kehadiran-pagi', 'materi-pagi', 'catatan-pagi'],
  '06:15': ['olahraga-pagi'],
  '07:30': ['kesiapan-1'],
  '09:30': ['kesiapan-2'],
  '12:45': ['kesiapan-3'],
  '16:00': ['ekskul-sore', 'catatan-ekskul', 'kesiapan-sore-opt'],
  '20:00': ['kehadiran-malam', 'materi-malam', 'kesiapan-malam', 'catatan-malam'],
  '22:00': ['absen-asrama', 'catatan-asrama']
};

const DRAFT_CHECKLIST_ACTIONS = [
  { no: 1, eng: "Has 3-color markers working properly", ind: "Spidol 3 warna berfungsi dengan baik" },
  { no: 2, eng: "Has an eraser", ind: "Penghapus berfungsi dengan baik" },
  { no: 3, eng: "Has functioning TV / LCD Projector", ind: "TV/LCD Proyektor berfungsi dengan baik" },
  { no: 4, eng: "Has functioning audio system", ind: "Speaker berfungsi dengan baik" },
  { no: 5, eng: "Has functioning air conditioner (AC)", ind: "AC berfungsi dengan baik" },
  { no: 6, eng: "Has functioning chairs & table for students and lecturer", ind: "Kursi & meja berfungsi dengan baik" },
  { no: 7, eng: "Has functioning lamps for lighting", ind: "Lampu pencahayaan berfungsi dengan baik" },
  { no: 8, eng: "Has functioning door", ind: "Pintu berfungsi dengan baik" },
  { no: 9, eng: "Has a bottle of water for the PIC", ind: "Botol air minum dosen tersedia" },
  { no: 10, eng: "Has an empty trash bin", ind: "Tempat sampah sudah dikosongkan" },
  { no: 11, eng: "Has clean whiteboard", ind: "Papan tulis telah dibersihkan" },
  { no: 12, eng: "Has no trash on the floor", ind: "Tidak ada sampah di lingkungan belajar" },
  { no: 13, eng: "Smells fresh & fragrant", ind: "Kelas harum dan wangi" },
  
  { no: 14, eng: "Their readiness & performance", ind: "Kesiapan belajar dan unjuk kerapian" },
  { no: 15, eng: "Uniform & accessories", ind: "Seragam & aksesoris" },
  { no: 16, eng: "Check the unwell, no-show, and/or on-leave student(s)", ind: "Memeriksa mahasiswa yang sakit, izin, dan/atau absen" },
  { no: 17, eng: "Hair, nail, beard, moustache, shoes, handwatch & hijab", ind: "Memeriksa rambut, kuku, janggut, kumis, sepatu, jam tangan & hijab" },
  { no: 18, eng: "Always greet with a smile", ind: "Selalu menyapa dengan senyuman" },
  { no: 19, eng: "Greet the lecturer in the class", ind: "Menyapa dosen di kelas saat masuk" },
  { no: 20, eng: "Part the lecturer in the class", ind: "Salam perpisahan ke dosen ketika meninggalkan kelas" }
];

// ============================================================
//  DOM HELPERS
// ============================================================
const $app   = () => document.getElementById('app');
const $modal = () => document.getElementById('modal-overlay');
const $toast = () => document.getElementById('toast-container');

function qs(sel, el = document) { return el.querySelector(sel); }
function qsa(sel, el = document) { return [...el.querySelectorAll(sel)]; }

// ============================================================
//  TOAST
// ============================================================
const TOAST_ICONS = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };

function toast(msg, type = 'success', duration = 3200) {
  const wrap = $toast();
  const el   = document.createElement('div');
  el.className = `toast t-${type}`;
  el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || '📌'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOutRight .3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ============================================================
//  MODAL
// ============================================================
function openModal(html) {
  const overlay = $modal();
  overlay.innerHTML = html;
  overlay.classList.remove('hidden');
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
}
function closeModal() {
  const overlay = $modal();
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  App.editStaffId = null;
}

// ============================================================
//  DATE / TIME HELPERS
// ============================================================
const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];

function formatDateLong(iso) {
  // iso: 'YYYY-MM-DD'
  const d = new Date(iso + 'T00:00:00');
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function nowTime() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const el = document.querySelector('.live-time');
    if (el) el.textContent = nowTime();
  }, 1000);
}

// ============================================================
//  SHARED HEADER
// ============================================================
function renderHeader() {
  const u    = App.user;
  const date = formatDateLong(DB.today());
  return `
    <header class="app-header">
      <div class="header-inner">
        <div class="header-brand">
          <span class="brand-icon">✈️</span>
          <div class="brand-text">
            <span class="brand-name">TIA AkademikAPP</span>
            <span class="brand-sub">Triesakti Institute of Airlines</span>
          </div>
        </div>
        <div class="header-right">
          <div class="header-date">${date} &nbsp;·&nbsp; <span class="live-time">${nowTime()}</span></div>
          <button class="btn btn-ghost btn-sm" onclick="triggerSyncData()" title="Sinkronisasi manual dengan cloud" id="btn-cloud-sync" style="display: flex; align-items: center; gap: 4px;">
            <span>🔄</span> <span>Sync</span>
          </button>
          <div class="user-chip">
            <div class="user-av">${DB.getInitials(u.nama)}</div>
            <div class="user-details">
              <span class="user-name-hd">${u.nama}</span>
              <span class="user-role-hd">${App.role === 'admin' ? '⭐ Manager' : '👤 Staf'}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="doLogout()">Keluar</button>
        </div>
      </div>
    </header>`;
}

function doLogout() {
  App.user = App.role = App.tab = null;
  App.selectedRoom = null;
  if (clockTimer) clearInterval(clockTimer);
  renderLogin();
}

async function triggerSyncData() {
  const btn = document.getElementById('btn-cloud-sync');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>Sync...</span>';
  }
  
  const isOnline = await DB.syncFromCloud();
  
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>🔄</span> <span>Sync</span>';
  }

  if (isOnline) {
    toast('✅ Database berhasil disinkronisasi online!', 'success');
  } else {
    toast('⚠️ Gagal sinkronisasi. Bekerja offline (LocalStorage).', 'warning');
  }

  // Refresh current view
  if (App.role === 'admin') {
    await renderAdminView(App.tab);
  } else if (App.role === 'staff') {
    await renderStaffView(App.tab);
  }
}

// ============================================================
//  LOGIN SCREEN
// ============================================================
function renderLogin() {
  const activeStaff = DB.getActiveStaff();

  $app().innerHTML = `
    <div class="login-screen">
      <div class="login-header">
        <div class="login-eyebrow">✈ Sistem Monitoring Akademik</div>
        <span class="login-plane">✈️</span>
        <h1 class="login-title">Triesakti Institute of Airlines</h1>
        <p class="login-desc">AkademikAPP · Platform Digital Manajemen Kelas</p>
      </div>

      <div class="login-card">
        <p class="login-card-title">Pilih Peran &amp; Masuk</p>

        <div class="role-options">
          <label>
            <input type="radio" id="r-admin" name="role" value="admin" class="role-radio"
              onchange="onRoleChange('admin')">
            <div class="role-label">
              <span class="role-emoji">👨‍💼</span>
              <span class="role-name">Manager Akademik</span>
              <span class="role-desc">Dashboard &amp; monitoring penuh</span>
            </div>
          </label>
          <label>
            <input type="radio" id="r-staff" name="role" value="staff" class="role-radio"
              onchange="onRoleChange('staff')">
            <div class="role-label">
              <span class="role-emoji">👩‍🏫</span>
              <span class="role-name">Staf Akademik</span>
              <span class="role-desc">Input log &amp; checklist kelas</span>
            </div>
          </label>
        </div>

        <div id="staff-select-wrap" class="staff-name-section hidden">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" for="sel-staff">Nama Staf <span class="req">*</span></label>
            <select class="form-control" id="sel-staff">
              <option value="">— Pilih nama Anda —</option>
              ${activeStaff.map(s => `<option value="${s.id}">${s.nama} — ${s.jabatan}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="login-divider"></div>

        <button class="btn btn-gold btn-full btn-lg" onclick="doLogin()" id="btn-masuk">
          ✈ Masuk ke Dashboard
        </button>

        <div class="login-footer">Triesakti Institute of Airlines &nbsp;·&nbsp; AkademikAPP v1.0</div>
      </div>
    </div>`;
}

function onRoleChange(role) {
  const wrap = document.getElementById('staff-select-wrap');
  if (role === 'staff') wrap.classList.remove('hidden');
  else wrap.classList.add('hidden');
}

function doLogin() {
  const roleEl = document.querySelector('input[name="role"]:checked');
  if (!roleEl) { toast('Pilih peran Anda terlebih dahulu', 'warning'); return; }

  App.role = roleEl.value;

  if (App.role === 'staff') {
    const selEl = document.getElementById('sel-staff');
    if (!selEl?.value) { toast('Pilih nama Anda terlebih dahulu', 'warning'); return; }
    App.user = DB.getStaffById(selEl.value);
    if (!App.user) { toast('Data staf tidak ditemukan', 'danger'); return; }
    renderStaffView('tracker');
  } else {
    App.user = { id: 'ADMIN', nama: 'Manager Akademik', jabatan: 'Administrator', status: 'Aktif' };
    renderAdminView('overview');
  }
}

// ============================================================
//  STAFF SHELL
// ============================================================
async function renderStaffView(tab = 'tracker') {
  App.tab = tab;
  await DB.syncFromCloud();
  const todayLogs = DB.getStaffLogsToday(App.user.id);

  const tabs = [
    { id: 'tracker',   emoji: '⏱️', label: 'Log Aktivitas',
      badge: `<span class="log-bubble">${todayLogs.length}</span>` },
    { id: 'checklist', emoji: '✅', label: 'Checklist Kelas', badge: '' }
  ];

  const tabsHtml = tabs.map(t => `
    <button id="tab-${t.id}" class="tab-btn ${tab === t.id ? 'active' : ''}"
      onclick="renderStaffView('${t.id}')">
      <span class="tab-emoji">${t.emoji}</span>${t.label}${t.badge}
    </button>`).join('');

  $app().innerHTML = `
    <div class="app-layout">
      ${renderHeader()}
      <main class="app-content">
        <div class="tab-nav">${tabsHtml}</div>
        <div class="tab-content anim-in" id="tab-body">
          ${tab === 'tracker'   ? buildTracker()   : ''}
          ${tab === 'checklist' ? buildChecklist() : ''}
        </div>
      </main>
    </div>`;

  startClock();

  // After DOM ready, initialise sub-view
  if (tab === 'tracker') {
    onLogJamChange();
  } else if (tab === 'checklist') {
    const room = App.selectedRoom || ROOMS[0].id;
    selectRoom(room);
  }
}

// ============================================================
//  FEATURE B — ACTIVITY TRACKER
// ============================================================
function buildTracker() {
  const today    = DB.today();
  const logs     = DB.getStaffLogsToday(App.user.id);
  const filled   = [...new Set(logs.map(l => l.jam))]; // Unique filled hours
  const avail    = TIME_SLOTS; // Allow all slots to be chosen
  const pct      = Math.round(filled.length / TIME_SLOTS.length * 100);

  // Initialize draft variables when rendering tracker tab
  App.draftLogs = {};
  App.activeCat = null;

  /* -- Heatmap cells -- */
  const hmCells = TIME_SLOTS.map(slot => {
    const slotLogs = logs.filter(l => l.jam === slot);
    const hasLog = slotLogs.length > 0;
    const tip = hasLog
      ? `${slot} · ${slotLogs.map(l => DB.getCategory(l.kategori).name).join(', ')}`
      : slot;
    return `<div class="hm-cell ${hasLog ? 'filled' : ''}" data-tip="${tip}">${slot.slice(0,2)}</div>`;
  }).join('');

  /* -- Timeline items -- */
  const tlHtml = logs.length === 0
    ? `<div class="timeline-empty">
         <div class="empty-big">📋</div>
         <p>Belum ada log aktivitas hari ini.</p>
         <p style="margin-top:6px;font-size:12px;">Gunakan form di sebelah kanan.</p>
       </div>`
    : logs.map(log => {
        const cat = DB.getCategory(log.kategori);
        let desc = log.deskripsi;
        
        if (desc && desc.startsWith('{') && desc.endsWith('}')) {
          try {
            const data = JSON.parse(desc);
            if (data && data.metadata) {
              const meta = data.metadata;
              const chk = data.checklist || {};
              const okCount = Object.values(chk).filter(v => v.val).length;
              const total = Object.keys(chk).length || 20;
              const rName = ROOMS.find(r => r.id === meta.class_room)?.name || meta.class_room;
              desc = `📝 <strong>${meta.subject || 'Mata Kuliah'}</strong> (${meta.pic_dosen || 'Dosen'}) · Room: ${rName} · ${meta.total_act || 0}/${meta.total_std || 0} Pax · ${okCount}/${total} OK`;
            }
          } catch(e) {}
        }

        return `
          <div class="timeline-item">
            <div class="tl-time">${log.jam}</div>
            <div class="tl-body">
              <div class="tl-cat">${cat.icon} ${cat.name}</div>
              <div class="tl-desc">${desc || '<em style="color:var(--text-muted)">Tidak ada deskripsi</em>'}</div>
            </div>
          </div>`;
      }).join('');

  /* -- Time slot dropdown -- */
  const slotOpts = avail.map(t => `<option value="${t}">${t}</option>`).join('');

  const formHtml = `
      <div class="form-group">
        <label class="form-label" for="log-jam">Pilih Jam <span class="req">*</span></label>
        <select class="form-control" id="log-jam" onchange="onLogJamChange()">${slotOpts}</select>
      </div>

      <div class="form-group">
        <label class="form-label">Pertanyaan Aktivitas <span class="req">*</span></label>
        <div class="cat-chips" id="cat-chips"></div>
        <input type="hidden" id="sel-cat" value="">
      </div>

      <div class="form-group" id="desc-group" style="display: none;">
        <label class="form-label" id="desc-label" for="log-desc">Deskripsi Detail <span class="req">*</span></label>
        <div id="dynamic-desc-container"></div>
        <span class="form-hint" id="desc-hint">Tuliskan kegiatan secara spesifik pada jam tersebut.</span>
      </div>

      <button class="btn btn-primary btn-full" onclick="saveLog()" id="btn-save-log">
        💾 Simpan Log Aktivitas
      </button>`;

  return `
    <div class="page-hd">
      <h2 class="page-title">⏱️ Log Aktivitas Harian</h2>
      <p class="page-sub">Catat aktivitas per jam · ${formatDateLong(today)}</p>
    </div>

    <div class="tracker-grid">
      <!-- Left: Timeline -->
      <div>
        <div class="section-hd">
          <div class="section-title">📋 Timeline Hari Ini</div>
          <span class="badge badge-info">${filled.length}/${TIME_SLOTS.length} jam terisi</span>
        </div>

        <div class="heatmap-panel mb-6">
          <div class="heatmap-label">Peta Aktivitas 05:00 – 22:00</div>
          <div class="heatmap-grid">${hmCells}</div>
          <div class="progress-bar mt-4">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <div style="text-align:right;font-size:10px;color:var(--text-muted);margin-top:4px">${pct}% terisi</div>
        </div>

        <div class="timeline">${tlHtml}</div>
      </div>

      <!-- Right: Form -->
      <div class="tracker-form-card">
        <div class="card">
          <div class="card-header">
            <div class="card-title">➕ Tambah Log</div>
          </div>
          <div class="card-body">${formHtml}</div>
        </div>
      </div>
    </div>`;
}

function pickCat(catId) {
  // Save current category input before changing active category
  saveCurrentInputToDraft();

  App.activeCat = catId;
  const inp = document.getElementById('sel-cat');
  if (inp) inp.value = catId;
  
  updateDynamicForm(catId);
  refreshCatChips();
}

function saveCurrentInputToDraft() {
  if (!App.activeCat) return;
  const catId = App.activeCat;
  
  // Check if this category is already saved in DB for selected jam (read-only)
  const jam = qs('#log-jam')?.value;
  const savedLogs = jam ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam) : [];
  const isSaved = savedLogs.some(l => l.kategori === catId);
  if (isSaved) return; // Do not overwrite saved content in draft

  if (catId === 'ekskul-sore') {
    const selected = qsa('input[name="ekskul-item"]:checked').map(el => el.value);
    App.draftLogs[catId] = selected.join(', ');
  } else if (catId === 'absen-asrama') {
    App.draftLogs[catId] = qs('#absen-status')?.value || '';
  } else {
    App.draftLogs[catId] = qs('#log-desc')?.value?.trim() || '';
  }
}

function refreshCatChips() {
  const jam = qs('#log-jam')?.value;
  const savedLogs = jam ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam) : [];
  const savedCatIds = savedLogs.map(l => l.kategori);

  qsa('.cat-chip').forEach(chip => {
    const catId = chip.dataset.id;
    const isSaved = savedCatIds.includes(catId);
    const isFilled = App.draftLogs && App.draftLogs[catId] && App.draftLogs[catId].trim() !== '';
    const isActive = App.activeCat === catId;
    
    chip.classList.toggle('active', isActive);
    chip.classList.toggle('filled', isFilled && !isSaved);
    chip.classList.toggle('saved', isSaved);
    
    const cat = DB.getCategory(catId);
    let extra = '';
    if (isSaved) {
      extra = ' <span class="chip-saved-badge">🔒 Terkirim</span>';
    } else if (isFilled) {
      extra = ' <span class="chip-check">✓</span>';
    }
    
    chip.innerHTML = `${cat.icon} ${cat.name}${extra}`;
  });
}

function onLogJamChange() {
  const jam = qs('#log-jam')?.value;
  if (!jam) return;

  // Clear drafts when hour changes
  App.draftLogs = {};
  App.activeCat = null;
  
  const hourCats = SLOT_CATEGORIES[jam] || [];
  
  // Render category chips for the selected hour
  const chipsContainer = document.getElementById('cat-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = ACTIVITY_CATS.filter(c => hourCats.includes(c.id)).map(c => `
      <div class="cat-chip" data-id="${c.id}" onclick="pickCat('${c.id}')">
        ${c.icon} ${c.name}
      </div>`).join('');
  }

  if (hourCats.length > 0) {
    pickCat(hourCats[0]);
  } else {
    // Hide active form if no categories
    const group = document.getElementById('desc-group');
    if (group) group.style.display = 'none';
  }
}

function updateDynamicForm(catId) {
  const container = document.getElementById('dynamic-desc-container');
  const group = document.getElementById('desc-group');
  const label = document.getElementById('desc-label');
  const hint = document.getElementById('desc-hint');

  if (!container || !group) return;

  group.style.display = 'block';
  container.innerHTML = '';

  const cat = DB.getCategory(catId);
  
  // Check if saved in db
  const jam = qs('#log-jam')?.value;
  const savedLogs = jam ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam) : [];
  const savedLog = savedLogs.find(l => l.kategori === catId);
  const isSaved = !!savedLog;
  
  label.innerHTML = `${cat.name} ${isSaved ? '<span class="badge badge-success" style="margin-left:8px;">Terkirim</span>' : '<span class="req">*</span>'}`;

  const draftVal = isSaved ? savedLog.deskripsi : (App.draftLogs[catId] || '');
  const dis = isSaved ? 'disabled' : '';

  if (catId.startsWith('kesiapan-')) {
    hint.textContent = isSaved 
      ? 'Checklist kelas sudah tersimpan untuk jam ini.' 
      : 'Isi checklist kesiapan ruangan dan pengecekan kedisiplinan siswa.';
      
    let data = null;
    try {
      if (draftVal) {
        data = JSON.parse(draftVal);
      }
    } catch(e) {}

    let summaryHtml = '';
    if (data && data.metadata) {
      const meta = data.metadata;
      const chk = data.checklist || {};
      const totalItems = Object.keys(chk).length || 20;
      const okItems = Object.values(chk).filter(v => v.val).length;
      const rName = ROOMS.find(r => r.id === meta.class_room)?.name || meta.class_room;
      summaryHtml = `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-sm); border-radius:var(--r-md); padding:14px; margin-bottom:12px; font-size:13px; text-align:left;">
          <div style="margin-bottom:6px;"><strong>Mata Kuliah:</strong> ${meta.subject || '—'}</div>
          <div style="margin-bottom:6px;"><strong>Dosen:</strong> ${meta.pic_dosen || '—'}</div>
          <div style="margin-bottom:6px;"><strong>Ruangan:</strong> ${rName || '—'}</div>
          <div style="margin-bottom:6px;"><strong>Kehadiran Siswa:</strong> ${meta.total_act || 0} / ${meta.total_std || 0} Pax</div>
          <div style="margin-bottom:6px;"><strong>Checklist:</strong> <span style="color:var(--success); font-weight:700;">${okItems}/${totalItems} OK</span></div>
        </div>`;
    } else {
      summaryHtml = `
        <div class="banner banner-warning mb-4" style="font-size:12px;">
          ⚠️ Formulir checklist kelas belum diisi. Silakan klik tombol di bawah untuk mengisi.
        </div>`;
    }

    container.innerHTML = `
      ${summaryHtml}
      <button class="btn btn-gold btn-full" onclick="openClassChecklistModal('${catId}')" style="margin-top:6px;">
        📋 ${isSaved ? 'Lihat Checklist Terkirim' : '📝 Buka Formulir Checklist Kelas'}
      </button>
      <input type="hidden" id="log-desc" value="${draftVal.replace(/"/g, '&quot;')}">`;
  } else if (catId === 'ekskul-sore') {
    hint.textContent = isSaved ? 'Sudah tersimpan untuk jam ini.' : 'Pilih satu atau beberapa olahraga ekstrakurikuler sore.';
    const sports = ['Renang', 'Gym', 'Futsal', 'Badminton', 'Volley', 'Basketball', 'Jogging', 'Tenis Meja', 'Literasi'];
    const checkedSports = draftVal ? draftVal.split(', ').map(s => s.trim()) : [];
    
    let html = `<div class="ekskul-checklist-grid">`;
    sports.forEach(sport => {
      const isChecked = checkedSports.includes(sport) ? 'checked' : '';
      html += `
        <label class="ekskul-item-label ${isSaved ? 'disabled-label' : ''}">
          <input type="checkbox" name="ekskul-item" value="${sport}" ${isChecked} ${dis} onchange="saveCurrentInputToDraft(); refreshCatChips();">
          <span>${sport}</span>
        </label>`;
    });
    html += `</div>`;
    container.innerHTML = html;
  } else if (catId === 'absen-asrama') {
    hint.textContent = isSaved ? 'Sudah tersimpan untuk jam ini.' : 'Pilih status kelengkapan absen asrama hari ini.';
    container.innerHTML = `
      <select class="form-control" id="absen-status" style="margin-top:4px;" ${dis} onchange="saveCurrentInputToDraft(); refreshCatChips();">
        <option value="">— Pilih Kelengkapan —</option>
        <option value="Lengkap" ${draftVal === 'Lengkap' ? 'selected' : ''}>Lengkap</option>
        <option value="Tidak Lengkap" ${draftVal === 'Tidak Lengkap' ? 'selected' : ''}>Tidak Lengkap</option>
      </select>`;
  } else {
    // Standard input/textarea based on "(diinput)"
    let placeholder = '';
    switch (catId) {
      case 'kehadiran-pagi':
        placeholder = 'Contoh: Hadir: 28, Sakit: 2 (Ahmad, Budi), Izin: 0, Alfa: 0';
        break;
      case 'materi-pagi':
        placeholder = 'Contoh: Navigasi Udara Bab 3 tentang Flight Instruments & Altimeter Settings';
        break;
      case 'catatan-pagi':
        placeholder = 'Contoh: Taruna sangat antusias membahas materi altimeter, kelas dimulai tepat waktu.';
        break;
      case 'olahraga-pagi':
        placeholder = 'Contoh: Senam Aerobik dipandu instruktur di lapangan sepak bola.';
        break;
      case 'catatan-ekskul':
        placeholder = 'Contoh: Latihan olahraga berjalan lancar, seluruh taruna berpartisipasi aktif.';
        break;
      case 'kehadiran-malam':
        placeholder = 'Contoh: Hadir: 30, Sakit: 0, Izin: 0';
        break;
      case 'materi-malam':
        placeholder = 'Contoh: Pembelajaran mandiri terarah membahas latihan kuis regulasi penerbangan.';
        break;
      case 'catatan-malam':
        placeholder = 'Contoh: Kelas malam tenang dan tertib, koneksi internet asrama stabil.';
        break;
      case 'catatan-asrama':
        placeholder = 'Contoh: Pengecekan kamar lengkap, kondisi asrama bersih, aman, dan kondusif.';
        break;
      default:
        placeholder = 'Masukkan detail aktivitas di sini...';
    }
    hint.textContent = isSaved ? 'Sudah tersimpan untuk jam ini.' : 'Berikan laporan tertulis mengenai kegiatan ini.';
    container.innerHTML = `
      <textarea class="form-control" id="log-desc" rows="4" placeholder="${placeholder}" style="margin-top:4px;" ${dis} oninput="saveCurrentInputToDraft(); refreshCatChips();">${draftVal}</textarea>`;
  }
  
  // Show or hide the submit button depending on whether the current active category is already saved
  const saveBtn = document.getElementById('btn-save-log');
  if (saveBtn) {
    saveBtn.style.display = isSaved ? 'none' : 'block';
  }
}

async function saveLog() {
  const jam = qs('#log-jam')?.value;
  if (!jam) { toast('Pilih jam aktivitas', 'warning'); return; }

  // Save the current input first before committing
  saveCurrentInputToDraft();

  // Filter out empty drafts for the ACTIVE hour categories only
  const activeCats = SLOT_CATEGORIES[jam] || [];
  const filledDrafts = Object.entries(App.draftLogs)
    .filter(([catId, val]) => activeCats.includes(catId) && val && val.trim() !== '');

  if (filledDrafts.length === 0) {
    toast('Isi minimal satu pertanyaan aktivitas sebelum menyimpan', 'warning');
    return;
  }

  // Validate duplicate category for this hour in database
  for (const [catId, _] of filledDrafts) {
    if (DB.isCategoryLogged(App.user.id, DB.today(), jam, catId)) {
      toast(`Pertanyaan ${DB.getCategory(catId).name} untuk jam ${jam} sudah pernah diisi hari ini!`, 'danger');
      return;
    }
  }

  // Save all non-empty drafts to DB
  for (const [catId, deskripsi] of filledDrafts) {
    await DB.addLog({
      staff_id:   App.user.id,
      staff_nama: App.user.nama,
      tanggal:    DB.today(),
      jam,
      kategori:   catId,
      deskripsi
    });
  }

  toast(`✈ Berhasil menyimpan ${filledDrafts.length} log aktivitas untuk jam ${jam}!`, 'success');
  
  // Reset draft logs and active category
  App.draftLogs = {};
  App.activeCat = null;
  
  await renderStaffView('tracker');
}

// ============================================================
//  FEATURE C — CLASS CHECKLIST
// ============================================================
function buildChecklist() {
  const today = DB.today();

  const roomListHtml = ROOMS.map(room => {
    const cl = DB.getChecklistByRoomToday(room.id);
    let badge = '<span class="badge badge-ghost">Belum</span>';
    if (cl?.submitted) {
      const hasIssue = Object.values(cl.items || {}).some(v => v === 'rusak');
      badge = hasIssue
        ? '<span class="badge badge-warning">⚠ Kendala</span>'
        : '<span class="badge badge-success">✓ Siap</span>';
    } else if (cl?.items && Object.values(cl.items).some(v => v === 'rusak')) {
      badge = '<span class="badge badge-danger">⚠ Masalah</span>';
    } else if (cl?.items && Object.keys(cl.items).length > 0) {
      badge = '<span class="badge badge-info">Proses</span>';
    }
    return `
      <button class="room-btn ${App.selectedRoom === room.id ? 'active' : ''}"
        id="rbtn-${room.id}" onclick="selectRoom('${room.id}')">
        <div class="room-btn-left">
          <span class="room-btn-icon">${room.icon}</span>
          <span class="room-btn-name">${room.name}</span>
        </div>
        ${badge}
      </button>`;
  }).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">✅ Checklist Persiapan Kelas</h2>
      <p class="page-sub">Periksa kesiapan setiap ruangan sebelum KBM · ${formatDateLong(today)}</p>
    </div>

    <div class="checklist-grid">
      <div>
        <div class="section-hd">
          <div class="section-title">🏫 Pilih Ruangan</div>
        </div>
        <div class="room-list" id="room-list">${roomListHtml}</div>
      </div>
      <div id="cl-form-area">
        <div class="empty-state">
          <div class="empty-big">👈</div>
          <p>Pilih ruangan di sebelah kiri untuk memulai checklist.</p>
        </div>
      </div>
    </div>`;
}

/** State for current checklist editing */
let clData = {};   // { itemId: 'ok' | 'rusak' }

function selectRoom(roomId) {
  App.selectedRoom = roomId;
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) return;

  /* Sync active class on room buttons */
  qsa('.room-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `rbtn-${roomId}`);
  });

  const today   = DB.today();
  const existing = DB.getChecklistByRoomToday(roomId);
  const items    = DB.getRoomItems(roomId);
  const locked   = existing?.submitted || false;

  /* Load saved items data */
  clData = existing?.items ? { ...existing.items } : {};

  const hasIssue  = Object.values(clData).some(v => v === 'rusak');
  const checked   = items.filter(it => clData[it.id] && clData[it.id] !== 'unchecked').length;
  const allDone   = checked === items.length;
  const pct       = Math.round(checked / items.length * 100);

  /* Render items */
  const itemsHtml = items.map(item => {
    const st = clData[item.id] || '';
    return `
      <div class="cl-item ${st === 'ok' ? 'cl-ok' : st === 'rusak' ? 'cl-rusak' : ''}" id="cli-${item.id}">
        <div class="cl-item-left">
          <span class="cl-item-icon">${item.icon}</span>
          <span class="cl-item-name">${item.name}
            ${st === 'rusak' ? ' <span class="badge badge-danger" style="margin-left:6px">⚠ RUSAK</span>' : ''}
          </span>
        </div>
        ${locked ? '' : `
        <div class="cl-item-actions">
          <button class="st-btn st-ok ${st === 'ok' ? 'on' : ''}"
            onclick="setItem('${roomId}','${item.id}','ok')">✓ OK</button>
          <button class="st-btn st-bad ${st === 'rusak' ? 'on' : ''}"
            onclick="setItem('${roomId}','${item.id}','rusak')">✕ Rusak</button>
        </div>`}
      </div>`;
  }).join('');

  /* Footer: submit or locked display */
  let footer = '';
  if (locked) {
    const lockedByIssue = Object.values(existing?.items || {}).some(v => v === 'rusak');
    footer = `
      <div class="cl-locked">
        <div class="lock-big">🔒</div>
        <p>${lockedByIssue ? '⚠️ Dikunci dengan catatan kendala' : '✅ Ruangan dikonfirmasi SIAP'}</p>
        <div class="lock-time">
          Oleh: ${existing.staff_nama || App.user.nama} ·
          ${existing.submitted_at ? new Date(existing.submitted_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : ''}
        </div>
      </div>`;
  } else {
    footer = `
      ${hasIssue ? `
        <div class="banner banner-warning mt-4">
          ⚠️ Ada item berstatus <strong>RUSAK</strong>. Segera laporkan ke teknisi sebelum mengunci.
        </div>` : ''}
      <button class="btn ${hasIssue ? 'btn-danger' : 'btn-success'} btn-full mt-4"
        onclick="lockChecklist('${roomId}')" ${!allDone ? 'disabled' : ''}>
        ${hasIssue ? '⚠️ Kunci Laporan (Ada Kendala)' : '🔒 Kunci & Konfirmasi Siap'}
      </button>
      ${!allDone
        ? `<p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:6px">
             Lengkapi semua ${items.length} item checklist terlebih dahulu
           </p>`
        : ''}`;
  }

  /* Inject into DOM */
  const area = document.getElementById('cl-form-area');
  if (!area) return;

  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${room.icon} ${room.name}</div>
        ${locked
          ? (Object.values(existing?.items||{}).some(v=>v==='rusak')
              ? '<span class="badge badge-warning">⚠ Kendala</span>'
              : '<span class="badge badge-success">✓ Siap</span>')
          : hasIssue
            ? '<span class="badge badge-danger">⚠ Ada Masalah</span>'
            : '<span class="badge badge-ghost">Belum Selesai</span>'}
      </div>
      <div class="card-body">
        <div class="cl-progress-row mb-4">
          <span>Progress Checklist</span>
          <span>${checked}/${items.length} item</span>
        </div>
        <div class="progress-bar mb-6">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="cl-items">${itemsHtml}</div>
        ${footer}
      </div>
    </div>`;

  /* Also refresh room-list badges without full re-render */
  refreshRoomBadges();
}

async function setItem(roomId, itemId, status) {
  clData[itemId] = status;
  await DB.saveChecklist({
    room_id:    roomId,
    tanggal:    DB.today(),
    staff_id:   App.user.id,
    staff_nama: App.user.nama,
    items:      { ...clData }
  });
  selectRoom(roomId);
}

async function lockChecklist(roomId) {
  const room     = ROOMS.find(r => r.id === roomId);
  const hasIssue = Object.values(clData).some(v => v === 'rusak');
  const msg = hasIssue
    ? `Ada item bermasalah di ${room.name}. Kunci laporan dengan catatan kendala?`
    : `Konfirmasi ${room.name} 100% siap. Kunci checklist?`;

  if (!confirm(msg)) return;

  await DB.submitChecklist(roomId);
  toast(
    hasIssue ? `⚠️ Laporan ${room.name} dikunci dengan catatan kendala!` : `🎉 ${room.name} dikonfirmasi SIAP!`,
    hasIssue ? 'warning' : 'success'
  );
  selectRoom(roomId);
}

/** Refresh only the badges in the room list without full re-render */
function refreshRoomBadges() {
  ROOMS.forEach(room => {
    const btn = document.getElementById(`rbtn-${room.id}`);
    if (!btn) return;
    const cl = DB.getChecklistByRoomToday(room.id);
    const badgeEl = btn.querySelector('.badge');
    if (!badgeEl) return;

    let badge = '<span class="badge badge-ghost">Belum</span>';
    if (cl?.submitted) {
      const hasIssue = Object.values(cl.items || {}).some(v => v === 'rusak');
      badge = hasIssue
        ? '<span class="badge badge-warning">⚠ Kendala</span>'
        : '<span class="badge badge-success">✓ Siap</span>';
    } else if (cl?.items && Object.values(cl.items).some(v => v === 'rusak')) {
      badge = '<span class="badge badge-danger">⚠ Masalah</span>';
    } else if (cl?.items && Object.keys(cl.items).length > 0) {
      badge = '<span class="badge badge-info">Proses</span>';
    }
    badgeEl.outerHTML = badge;
  });
}

// ============================================================
//  ADMIN SHELL
// ============================================================
async function renderAdminView(tab = 'overview') {
  App.tab = tab;
  await DB.syncFromCloud();

  const tabs = [
    { id: 'overview', emoji: '📊', label: 'Dashboard'      },
    { id: 'staff',    emoji: '👥', label: 'Master Staf'    },
    { id: 'logs',     emoji: '📋', label: 'Log Aktivitas'  },
    { id: 'issues',   emoji: '⚠️', label: 'Laporan Kendala' }
  ];

  const tabsHtml = tabs.map(t => `
    <button class="tab-btn ${tab === t.id ? 'active' : ''}" onclick="renderAdminView('${t.id}')">
      <span class="tab-emoji">${t.emoji}</span>${t.label}
    </button>`).join('');

  const content = {
    overview: buildOverview,
    staff:    buildStaffMgmt,
    logs:     buildLogsView,
    issues:   buildIssueAlerts
  }[tab]?.() || '';

  $app().innerHTML = `
    <div class="app-layout">
      ${renderHeader()}
      <main class="app-content">
        <div class="tab-nav">${tabsHtml}</div>
        <div class="tab-content anim-in" id="tab-body">${content}</div>
      </main>
    </div>`;

  startClock();
}

// ============================================================
//  FEATURE D — DASHBOARD OVERVIEW
// ============================================================
function buildOverview() {
  const today   = DB.today();
  const staff   = DB.getActiveStaff();
  const logs    = DB.getLogs({ tanggal: today });
  const withLog = [...new Set(logs.map(l => l.staff_id))];
  const cls     = DB.getAllChecklistsToday();
  const submitted = cls.filter(c => c.submitted);
  const issuesCL  = cls.filter(c => c.items && Object.values(c.items).some(v => v === 'rusak'));

  /* Stats */
  const statsHtml = `
    <div class="stats-grid">
      <div class="stat-card stat-primary">
        <div class="stat-emoji">👥</div>
        <div class="stat-value">${staff.length}</div>
        <div class="stat-label">Staf Aktif</div>
      </div>
      <div class="stat-card stat-gold">
        <div class="stat-emoji">📝</div>
        <div class="stat-value">${withLog.length}</div>
        <div class="stat-label">Staf Isi Log Hari Ini</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-emoji">🔒</div>
        <div class="stat-value">${submitted.length}</div>
        <div class="stat-label">Kelas Siap</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-emoji">⚠️</div>
        <div class="stat-value">${issuesCL.length}</div>
        <div class="stat-label">Kelas Bermasalah</div>
      </div>
    </div>`;

  /* Staff table */
  const staffRows = staff.map(s => {
    const sLogs = logs.filter(l => l.staff_id === s.id);
    const last  = sLogs[sLogs.length - 1];
    const cat   = last ? DB.getCategory(last.kategori) : null;
    return `
      <tr>
        <td>
          <div class="name-cell">
            <div class="av av-sm">${DB.getInitials(s.nama)}</div>
            <div class="name-cell-text">
              <div class="name-cell-main">${s.nama}</div>
              <div class="name-cell-sub">${s.jabatan}</div>
            </div>
          </div>
        </td>
        <td>${sLogs.length > 0
          ? '<span class="badge badge-success"><span class="dot dot-success"></span>Aktif</span>'
          : '<span class="badge badge-ghost"><span class="dot dot-muted"></span>Belum</span>'}</td>
        <td>${sLogs.length > 0 ? `<span class="log-bubble">${sLogs.length}</span>` : '—'}</td>
        <td>${last ? `<span class="badge badge-info">${last.jam}</span>` : '—'}</td>
        <td class="text-sm text-muted">${cat ? `${cat.icon} ${cat.name}` : '—'}</td>
      </tr>`;
  }).join('');

  /* Room status grid */
  const roomCards = ROOMS.map(room => {
    const cl = DB.getChecklistByRoomToday(room.id);
    let cls2 = '', badge = '<span class="badge badge-ghost">Belum Diperiksa</span>', time = '';
    if (cl?.submitted) {
      const hi = Object.values(cl.items || {}).some(v => v === 'rusak');
      cls2  = hi ? 'rs-warn' : 'rs-ready';
      badge = hi ? '<span class="badge badge-warning">⚠ Ada Kendala</span>' : '<span class="badge badge-success">✅ Siap</span>';
      time  = cl.submitted_at ? `<div class="rs-time">Dikunci ${new Date(cl.submitted_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>` : '';
    } else if (cl?.items && Object.values(cl.items).some(v => v === 'rusak')) {
      cls2  = 'rs-issue';
      badge = '<span class="badge badge-danger">🔴 Masalah</span>';
    }
    return `
      <div class="room-status-card ${cls2}">
        <div class="rs-icon">${room.icon}</div>
        <div class="rs-name">${room.name}</div>
        ${badge}${time}
      </div>`;
  }).join('');

  /* Staff heatmap */
  const hmLabels = `
    <div class="shm-row" style="margin-bottom:4px">
      <div class="shm-name"></div>
      <div class="shm-labels">${TIME_SLOTS.map(t => `<div class="shm-label-item">${t.slice(0,2)}</div>`).join('')}</div>
      <div class="shm-count"></div>
    </div>`;

  const hmRows = staff.map(s => {
    const sLogs  = logs.filter(l => l.staff_id === s.id);
    const filled = [...new Set(sLogs.map(l => l.jam))]; // Unique filled hours
    const slots  = TIME_SLOTS.map(slot => {
      const slotLogs = sLogs.filter(l => l.jam === slot);
      const hasLog = slotLogs.length > 0;
      const tip = hasLog
        ? `${slot} · ${slotLogs.map(l => DB.getCategory(l.kategori).name).join(', ')}`
        : '';
      const clickAttr = hasLog ? `onclick="showStaffSlotDetails('${s.id}', '${slot}')"` : '';
      return `<div class="shm-slot ${hasLog ? 'on' : ''}" ${clickAttr} data-tip="${tip}"></div>`;
    }).join('');
    return `
      <div class="shm-row">
        <div class="shm-name" title="${s.nama}">${s.nama.split(' ')[0]}</div>
        <div class="shm-slots">${slots}</div>
        <div class="shm-count">${filled.length}</div>
      </div>`;
  }).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">📊 Dashboard Monitoring Real-Time</h2>
      <p class="page-sub">Pantau status staf dan kesiapan kelas · ${formatDateLong(today)}</p>
    </div>

    ${statsHtml}

    <div class="dash-grid">
      <!-- Staff Activity Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">👥 Status Aktivitas Staf</div>
          <span class="badge badge-info">Hari Ini</span>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Nama Staf</th>
                <th>Status</th>
                <th>Log</th>
                <th>Jam Terakhir</th>
                <th>Aktivitas Terakhir</th>
              </tr>
            </thead>
            <tbody>
              ${staffRows || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Belum ada log hari ini</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Room Status -->
      <div>
        <div class="section-hd">
          <div class="section-title">🏫 Status Kesiapan Kelas</div>
        </div>
        <div class="room-grid">${roomCards}</div>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="card mt-6">
      <div class="card-header">
        <div class="card-title">🔥 Heatmap Aktivitas (05:00–22:00)</div>
        <span class="badge badge-ghost">Total: ${logs.length} log</span>
      </div>
      <div class="card-body">
        <div class="staff-hm">
          ${hmLabels}
          ${staff.length > 0 ? hmRows : '<p style="text-align:center;font-size:13px;color:var(--text-muted)">Belum ada log aktivitas.</p>'}
        </div>
      </div>
    </div>

    <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:var(--sp-5)">
      💡 Klik tab <strong>Dashboard</strong> untuk refresh data terbaru
    </p>`;
}

function showStaffSlotDetails(staffId, jam) {
  const s = DB.getStaffById(staffId);
  if (!s) return;

  const logs = DB.getLogs({ staffId, tanggal: DB.today() }).filter(l => l.jam === jam);
  if (logs.length === 0) {
    toast('Belum ada aktivitas yang dicatat pada jam ini.', 'info');
    return;
  }

  // Construct modal content
  let listHtml = '';
  logs.forEach(log => {
    const cat = DB.getCategory(log.kategori);
    const sentTime = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    let isStructured = false;
    let structData = null;
    if (log.deskripsi && log.deskripsi.startsWith('{') && log.deskripsi.endsWith('}')) {
      try {
        structData = JSON.parse(log.deskripsi);
        if (structData && (structData.metadata || structData.checklist)) {
          isStructured = true;
        }
      } catch(e) {}
    }

    if (isStructured && structData) {
      const meta = structData.metadata || {};
      const chk = structData.checklist || {};
      const rName = ROOMS.find(r => r.id === meta.class_room)?.name || meta.class_room;
      
      // Calculate progress
      const totalItems = Object.keys(chk).length || 20;
      const okItems = Object.values(chk).filter(v => v.val).length;
      
      // Create list of checklist items that are NOT OK, or a list of remarks
      let issueItemsHtml = '';
      DRAFT_CHECKLIST_ACTIONS.forEach(item => {
        const itemVal = chk[item.no] || { val: false, remark: '' };
        if (!itemVal.val || itemVal.remark) {
          issueItemsHtml += `
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.02); font-size:12px; gap:8px;">
              <span style="color:var(--text-secondary);"><strong style="color:var(--text-muted);">${item.no}.</strong> ${item.eng}</span>
              <div style="text-align:right;">
                <span class="badge ${itemVal.val ? 'badge-success' : 'badge-danger'}" style="font-size:9px; padding:1px 4px;">${itemVal.val ? '✓' : 'RUSAK / NO'}</span>
                ${itemVal.remark ? `<div style="font-size:10px; color:var(--gold-light); margin-top:2px;">Remark: ${itemVal.remark}</div>` : ''}
              </div>
            </div>`;
        }
      });
      
      if (!issueItemsHtml) {
        issueItemsHtml = `<div style="font-size:12px; color:var(--success); font-style:italic;">🎉 Semua item checklist (20/20) berstatus OK!</div>`;
      }

      listHtml += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-xs); border-radius:var(--r-md); padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px; margin-bottom:10px;">
            <div style="font-weight:700; color:var(--text-primary); font-size:14px; display:flex; align-items:center; gap:6px;">
              <span>🏫</span> <span>${cat.name}</span>
            </div>
            <span class="badge badge-ghost" style="font-size:10px;">${sentTime}</span>
          </div>
          
          <!-- Metadata Summary Table -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px; margin-bottom:14px; color:var(--text-secondary);">
            <div>
              <div><strong>Mata Kuliah:</strong> ${meta.subject || '—'}</div>
              <div><strong>Dosen:</strong> ${meta.pic_dosen || '—'}</div>
              <div><strong>Ruangan:</strong> ${rName || '—'}</div>
              <div><strong>Ketua Kelas:</strong> ${meta.chairman || '—'}</div>
              <div><strong>Program:</strong> ${meta.program || '—'}</div>
            </div>
            <div>
              <div><strong>Total Siswa (Pax):</strong> ${meta.total_std || 0}</div>
              <div><strong>Sakit/Izin/Alfa:</strong> ${meta.unwell}/${meta.on_leave}/${meta.no_show}</div>
              <div><strong>Total Hadir (Act):</strong> <strong style="color:var(--success);">${meta.total_act || 0}</strong></div>
              <div><strong>STD / ATD:</strong> ${meta.std || '—'} / ${meta.atd || '—'}</div>
              <div><strong>STA / ATA:</strong> ${meta.sta || '—'} / ${meta.ata || '—'}</div>
            </div>
          </div>
          
          <!-- Issues / Checklist Exceptions -->
          <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
            <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Laporan Masalah &amp; Remark (${totalItems - okItems} Masalah)</div>
            ${issueItemsHtml}
          </div>
        </div>`;
    } else {
      // Normal display
      listHtml += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-xs); border-radius:var(--r-md); padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
            <div style="font-weight:700; color:var(--text-primary); font-size:14px; display:flex; align-items:center; gap:6px;">
              <span>${cat.icon}</span> <span>${cat.name}</span>
            </div>
            <span class="badge badge-ghost" style="font-size:10px;">${sentTime}</span>
          </div>
          <div style="color:var(--text-secondary); font-size:13px; line-height:1.6; white-space:pre-line; word-break:break-word;">
            ${log.deskripsi || '<em style="color:var(--text-muted)">Tidak ada deskripsi</em>'}
          </div>
        </div>`;
    }
  });

  openModal(`
    <div class="modal-box" style="max-width:520px;">
      <div class="modal-hd">
        <div style="display:flex; flex-direction:column; gap:2px; text-align:left;">
          <h3 class="modal-title">📋 Detail Aktivitas</h3>
          <span style="font-size:11px; color:var(--text-muted); font-weight:500;">
            ${s.nama} (${s.jabatan}) · Checkpoint ${jam}
          </span>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="max-height:400px; overflow-y:auto; padding-right:6px; text-align:left;">
        ${listHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="closeModal()">Tutup</button>
      </div>
    </div>`);
}

// ============================================================
//  FEATURE A — STAFF MANAGEMENT (Admin)
// ============================================================
function buildStaffMgmt() {
  const all = DB.getAllStaff();

  const rows = all.map(s => `
    <tr>
      <td class="text-xs text-muted">${s.id}</td>
      <td>
        <div class="name-cell">
          <div class="av av-sm">${DB.getInitials(s.nama)}</div>
          <span class="td-strong">${s.nama}</span>
        </div>
      </td>
      <td class="text-sm">${s.jabatan}</td>
      <td>
        <span class="badge ${s.status === 'Aktif' ? 'badge-success' : 'badge-ghost'}">
          <span class="dot ${s.status === 'Aktif' ? 'dot-success' : 'dot-muted'}"></span>
          ${s.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="openEditStaff('${s.id}')">✏️ Edit</button>
          <button class="btn ${s.status === 'Aktif' ? 'btn-danger' : 'btn-success'} btn-sm"
            onclick="toggleStaff('${s.id}')">
            ${s.status === 'Aktif' ? '🔴 Nonaktifkan' : '🟢 Aktifkan'}
          </button>
          <button class="btn btn-delete btn-sm" onclick="deleteStaff('${s.id}')" title="Hapus permanen">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">👥 Master Data Staf</h2>
      <p class="page-sub">Kelola data staf akademik · ${all.length} staf terdaftar</p>
    </div>

    <div class="staff-toolbar">
      <button class="btn btn-primary" onclick="openAddStaff()">➕ Tambah Staf Baru</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID Staf</th>
              <th>Nama</th>
              <th>Jabatan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

const JABATAN_OPTIONS = [
  'Koordinator Akademik',
  'Staf Akademik',
  'Staf Pengajar',
  'Admin Akademik',
  'Staf Piket',
  'Teknisi'
];

function staffModal({ title, nama = '', jabatan = '', id = null }) {
  const opts = JABATAN_OPTIONS.map(j =>
    `<option value="${j}" ${jabatan === j ? 'selected' : ''}>${j}</option>`
  ).join('');

  openModal(`
    <div class="modal-box">
      <div class="modal-hd">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="m-nama">Nama Lengkap <span class="req">*</span></label>
          <input type="text" class="form-control" id="m-nama" value="${nama}"
            placeholder="Contoh: Ahmad Fauzi Ramadhan">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="m-jabatan">Jabatan <span class="req">*</span></label>
          <select class="form-control" id="m-jabatan">
            <option value="">— Pilih Jabatan —</option>
            ${opts}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveStaff()">💾 Simpan</button>
      </div>
    </div>`);
}

function openAddStaff() {
  App.editStaffId = null;
  staffModal({ title: '➕ Tambah Staf Baru' });
}

function openEditStaff(id) {
  const s = DB.getStaffById(id);
  if (!s) return;
  App.editStaffId = id;
  staffModal({ title: '✏️ Edit Data Staf', nama: s.nama, jabatan: s.jabatan, id });
}

async function saveStaff() {
  const nama    = qs('#m-nama')?.value?.trim();
  const jabatan = qs('#m-jabatan')?.value;
  if (!nama)    { toast('Nama tidak boleh kosong', 'warning'); return; }
  if (!jabatan) { toast('Pilih jabatan', 'warning');           return; }

  if (App.editStaffId) {
    await DB.updateStaff(App.editStaffId, { nama, jabatan });
    toast(`✅ Data ${nama} diperbarui!`, 'success');
  } else {
    await DB.addStaff({ nama, jabatan });
    toast(`✅ Staf ${nama} ditambahkan!`, 'success');
  }
  closeModal();
  await renderAdminView('staff');
}

async function toggleStaff(id) {
  const s = DB.getStaffById(id);
  if (!s) return;
  const act = s.status === 'Aktif' ? 'menonaktifkan' : 'mengaktifkan';
  if (!confirm(`Anda yakin ingin ${act} staf ${s.nama}?`)) return;
  await DB.toggleStaffStatus(id);
  toast(`✅ Status ${s.nama} berhasil diubah!`, 'success');
  await renderAdminView('staff');
}

async function deleteStaff(id) {
  const s = DB.getStaffById(id);
  if (!s) return;
  if (!confirm(`⚠️ HAPUS PERMANEN\n\nAnda akan menghapus staf:\n"${s.nama}" — ${s.jabatan}\n\nData yang sudah terhapus tidak dapat dipulihkan. Lanjutkan?`)) return;
  await DB.deleteStaff(id);
  toast(`🗑️ Staf "${s.nama}" berhasil dihapus.`, 'warning');
  await renderAdminView('staff');
}

// ============================================================
//  ACTIVITY LOGS VIEW (Admin)
// ============================================================
function buildLogsView() {
  const today = DB.today();
  const logs  = DB.getLogs({ tanggal: today });
  const staff = DB.getAllStaff();

  const rows = logs.map(log => {
    const s   = staff.find(st => st.id === log.staff_id);
    const cat = DB.getCategory(log.kategori);
    
    let desc = log.deskripsi;
    if (desc && desc.startsWith('{') && desc.endsWith('}')) {
      try {
        const data = JSON.parse(desc);
        if (data && data.metadata) {
          const meta = data.metadata;
          const chk = data.checklist || {};
          const okCount = Object.values(chk).filter(v => v.val).length;
          const total = Object.keys(chk).length || 20;
          const rName = ROOMS.find(r => r.id === meta.class_room)?.name || meta.class_room;
          desc = `📝 <strong>${meta.subject || 'Mata Kuliah'}</strong> (${meta.pic_dosen || 'Dosen'}) · Room: ${rName} · ${meta.total_act || 0}/${meta.total_std || 0} Pax · ${okCount}/${total} OK`;
        }
      } catch(e) {}
    }
    
    return `
      <tr>
        <td>
          <div class="name-cell">
            <div class="av av-sm">${DB.getInitials(s?.nama || log.staff_nama || '?')}</div>
            <span class="td-strong">${s?.nama || log.staff_nama || log.staff_id}</span>
          </div>
        </td>
        <td><span class="badge badge-primary">${log.jam}</span></td>
        <td class="text-sm">${cat.icon} ${cat.name}</td>
        <td style="max-width:320px">
          <span class="text-sm text-muted">${desc || '<em style="color:var(--text-muted)">—</em>'}</span>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">📋 Log Aktivitas Staf</h2>
      <p class="page-sub">Semua log hari ini · ${formatDateLong(today)} · ${logs.length} entri</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 Rekap Log Hari Ini</div>
        <span class="badge badge-gold">${logs.length} entri</span>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Nama Staf</th>
              <th>Jam</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0
              ? rows
              : '<tr><td colspan="4" style="text-align:center;padding:48px;color:var(--text-muted)">Belum ada log aktivitas hari ini</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
//  ISSUE ALERTS VIEW (Admin)
// ============================================================
function buildIssueAlerts() {
  const today  = DB.today();
  const cls    = DB.getAllChecklistsToday();
  const issues = [];

  cls.forEach(cl => {
    const room = ROOMS.find(r => r.id === cl.room_id);
    if (!cl.items) return;
    Object.entries(cl.items).forEach(([itemId, status]) => {
      if (status !== 'rusak') return;
      const item = CHECKLIST_ITEMS.find(i => i.id === itemId);
      issues.push({ room, item, cl });
    });
  });

  /* Summary by room */
  const byRoom = {};
  issues.forEach(({ room }) => {
    const n = room?.name || '?';
    byRoom[n] = (byRoom[n] || 0) + 1;
  });

  const statsHtml = issues.length > 0 ? `
    <div class="stats-grid" style="margin-bottom:var(--sp-6)">
      <div class="stat-card stat-danger">
        <div class="stat-emoji">🔴</div>
        <div class="stat-value">${issues.length}</div>
        <div class="stat-label">Total Item Bermasalah</div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-emoji">🏫</div>
        <div class="stat-value">${Object.keys(byRoom).length}</div>
        <div class="stat-label">Ruangan Terdampak</div>
      </div>
    </div>` : '';

  const listHtml = issues.length === 0
    ? `<div class="no-issues">
         <div class="no-issues-icon">✅</div>
         <p>Tidak ada kendala yang dilaporkan hari ini!</p>
         <span>Semua ruangan dalam kondisi baik.</span>
       </div>`
    : issues.map(({ room, item, cl }) => `
        <div class="issue-item">
          <span class="issue-dot">🔴</span>
          <div>
            <div class="issue-room">${room?.icon || '🏫'} ${room?.name || cl.room_id}</div>
            <div class="issue-item-nm">${item?.icon || '⚠️'} ${item?.name || cl.room_id}</div>
            <div class="issue-meta">
              Dilaporkan oleh: ${cl.staff_nama || 'Staf'}
              ${cl.submitted_at
                ? ' · ' + new Date(cl.submitted_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
                : ' · Belum dikunci'}
            </div>
          </div>
        </div>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">⚠️ Laporan Kendala &amp; Fasilitas</h2>
      <p class="page-sub">Item bermasalah yang perlu ditindaklanjuti · ${formatDateLong(today)}</p>
    </div>

    ${statsHtml}

    <div class="card">
      <div class="card-header">
        <div class="card-title">🔴 Daftar Item Bermasalah</div>
        ${issues.length > 0
          ? `<span class="badge badge-danger">${issues.length} masalah</span>`
          : '<span class="badge badge-success">Semua OK</span>'}
      </div>
      <div class="card-body">
        <div class="issue-list">${listHtml}</div>
      </div>
    </div>`;
}

function openClassChecklistModal(catId) {
  // Check if saved in db
  const jam = qs('#log-jam')?.value;
  const savedLogs = jam ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam) : [];
  const savedLog = savedLogs.find(l => l.kategori === catId);
  const isSaved = !!savedLog;
  
  const rawData = isSaved ? savedLog.deskripsi : (App.draftLogs[catId] || '');
  let data = {
    metadata: {
      pic_dosen: '', subject: '', class_room: '', chairman: '', program: '',
      total_std: '', unwell: 0, no_show: 0, on_leave: 0, total_act: 0,
      std: '', atd: '', sta: '', ata: ''
    },
    checklist: {}
  };

  try {
    if (rawData) {
      data = JSON.parse(rawData);
    }
  } catch(e) {}

  const meta = data.metadata || {};
  const chk = data.checklist || {};
  const dis = isSaved ? 'disabled' : '';

  // Options for class room dropdown
  const roomOpts = ROOMS.map(r => 
    `<option value="${r.id}" ${meta.class_room === r.id ? 'selected' : ''}>${r.name}</option>`
  ).join('');

  // 20 actions HTML
  let rowsHtml = '';
  DRAFT_CHECKLIST_ACTIONS.forEach(item => {
    const itemData = chk[item.no] || { val: false, remark: '' };
    const isChecked = itemData.val ? 'checked' : '';
    rowsHtml += `
      <div class="chk-modal-row" style="display:flex; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04); padding:10px 0; gap:12px;">
        <div style="width:28px; font-weight:700; color:var(--text-muted); font-size:12px; text-align:center;">${item.no}</div>
        <div style="flex:1; text-align:left;">
          <div style="font-size:13px; font-weight:600; color:var(--text-primary); line-height:1.4;">${item.eng}</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.3;">${item.ind}</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; color:var(--text-primary);">
            <input type="checkbox" class="modal-chk-val" data-no="${item.no}" ${isChecked} ${dis} style="width:16px; height:16px; accent-color:var(--success);">
            <span>OK</span>
          </label>
          <input type="text" class="form-control modal-chk-remark" data-no="${item.no}" value="${itemData.remark || ''}" ${dis} style="width:180px; padding:6px 10px; font-size:12px;" placeholder="Remarks...">
        </div>
      </div>`;
  });

  const modalHtml = `
    <div class="modal-box" style="max-width:850px; width:95%;">
      <div class="modal-hd">
        <div style="text-align:left;">
          <h3 class="modal-title">📋 Class Checklist Form</h3>
          <span style="font-size:11px; color:var(--text-muted); font-weight:500;">
            Triesakti Institute of Airlines · Kesiapan &amp; Kerapian Kelas
          </span>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="max-height:65vh; overflow-y:auto; padding-right:10px;">
        
        <!-- Metadata 2-Column Grid -->
        <h4 style="color:var(--gold-light); font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; margin-bottom:14px; text-align:left;">
          Class Preparation Metadata
        </h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:24px; text-align:left;">
          <!-- Left Column -->
          <div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">P.I.C / Dosen <span class="req">*</span></label>
              <input type="text" class="form-control" id="c-pic" value="${meta.pic_dosen || ''}" ${dis} placeholder="Nama dosen pengajar">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">Subject / Mata Kuliah <span class="req">*</span></label>
              <input type="text" class="form-control" id="c-subject" value="${meta.subject || ''}" ${dis} placeholder="Nama mata kuliah">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">A/C Reg. / Ruang Kelas <span class="req">*</span></label>
              <select class="form-control" id="c-room" ${dis}>
                <option value="">— Pilih Ruangan —</option>
                ${roomOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">Chairman / Ketua Kelas</label>
              <input type="text" class="form-control" id="c-chairman" value="${meta.chairman || ''}" ${dis} placeholder="Ketua kelas / perwakilan">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">Class Program / Jurusan</label>
              <input type="text" class="form-control" id="c-program" value="${meta.program || ''}" ${dis} placeholder="Program studi / angkatan">
            </div>
            <div style="display:flex; gap:12px;">
              <div class="form-group" style="flex:1;">
                <label class="form-label" style="font-size:10px;">STD (Class Start)</label>
                <input type="time" class="form-control" id="c-std" value="${meta.std || ''}" ${dis}>
              </div>
              <div class="form-group" style="flex:1;">
                <label class="form-label" style="font-size:10px;">ATD (Actual Start)</label>
                <input type="time" class="form-control" id="c-atd" value="${meta.atd || ''}" ${dis}>
              </div>
            </div>
          </div>
          
          <!-- Right Column -->
          <div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">Total Std. Pax (Total Siswa) <span class="req">*</span></label>
              <input type="number" class="form-control" id="c-total-std" value="${meta.total_std || ''}" ${dis} min="0" placeholder="0" oninput="calcActualPax()">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">Unwell Pax (Sakit)</label>
              <input type="number" class="form-control" id="c-unwell" value="${meta.unwell || 0}" ${dis} min="0" placeholder="0" oninput="calcActualPax()">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">No-show Pax (Absent/Alfa)</label>
              <input type="number" class="form-control" id="c-no-show" value="${meta.no_show || 0}" ${dis} min="0" placeholder="0" oninput="calcActualPax()">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px;">On-leave Pax (Izin)</label>
              <input type="number" class="form-control" id="c-on-leave" value="${meta.on_leave || 0}" ${dis} min="0" placeholder="0" oninput="calcActualPax()">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:10px; color:var(--success);">Total Act. Pax (Total Hadir)</label>
              <input type="number" class="form-control" id="c-total-act" value="${meta.total_act || 0}" disabled style="background:rgba(16,185,129,0.05); color:var(--success); border-color:var(--success-border);" placeholder="0">
            </div>
            <div style="display:flex; gap:12px;">
              <div class="form-group" style="flex:1;">
                <label class="form-label" style="font-size:10px;">STA (Class End)</label>
                <input type="time" class="form-control" id="c-sta" value="${meta.sta || ''}" ${dis}>
              </div>
              <div class="form-group" style="flex:1;">
                <label class="form-label" style="font-size:10px;">ATA (Actual End)</label>
                <input type="time" class="form-control" id="c-ata" value="${meta.ata || ''}" ${dis}>
              </div>
            </div>
          </div>
        </div>

        <!-- Checklist Actions Section -->
        <h4 style="color:var(--gold-light); font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; margin-bottom:14px; text-align:left;">
          Classroom &amp; Students Checklist
        </h4>
        <div style="display:flex; flex-direction:column; background:rgba(0,0,0,0.2); border:1px solid var(--border-sm); border-radius:var(--r-md); padding:0 14px;">
          ${rowsHtml}
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
        ${isSaved ? '' : `<button class="btn btn-gold" onclick="saveClassChecklistDraft('${catId}')">💾 Simpan Draf Checklist</button>`}
      </div>
    </div>`;

  openModal(modalHtml);
  calcActualPax(); // Auto calculate initial Total Act Pax
}

function calcActualPax() {
  const total = parseInt(qs('#c-total-std')?.value) || 0;
  const unwell = parseInt(qs('#c-unwell')?.value) || 0;
  const noshow = parseInt(qs('#c-no-show')?.value) || 0;
  const onleave = parseInt(qs('#c-on-leave')?.value) || 0;
  
  const act = Math.max(0, total - unwell - noshow - onleave);
  const actEl = qs('#c-total-act');
  if (actEl) actEl.value = act;
}

function saveClassChecklistDraft(catId) {
  const pic = qs('#c-pic')?.value?.trim();
  const subject = qs('#c-subject')?.value?.trim();
  const room = qs('#c-room')?.value;
  const totalStdVal = qs('#c-total-std')?.value;

  if (!pic) { toast('Dosen (P.I.C) harus diisi', 'warning'); return; }
  if (!subject) { toast('Subject / Mata Kuliah harus diisi', 'warning'); return; }
  if (!room) { toast('Pilih Ruang Kelas', 'warning'); return; }
  if (totalStdVal === '') { toast('Total Siswa harus diisi', 'warning'); return; }

  const totalStd = parseInt(totalStdVal) || 0;
  const unwell = parseInt(qs('#c-unwell')?.value) || 0;
  const noShow = parseInt(qs('#c-no-show')?.value) || 0;
  const onLeave = parseInt(qs('#c-on-leave')?.value) || 0;
  const totalAct = Math.max(0, totalStd - unwell - noShow - onLeave);

  const draftData = {
    metadata: {
      pic_dosen: pic,
      subject,
      class_room: room,
      chairman: qs('#c-chairman')?.value?.trim() || '',
      program: qs('#c-program')?.value?.trim() || '',
      total_std: totalStd,
      unwell,
      no_show: noShow,
      on_leave: onLeave,
      total_act: totalAct,
      std: qs('#c-std')?.value || '',
      atd: qs('#c-atd')?.value || '',
      sta: qs('#c-sta')?.value || '',
      ata: qs('#c-ata')?.value || ''
    },
    checklist: {}
  };

  // Read checklist items
  qsa('.modal-chk-val').forEach(el => {
    const no = el.dataset.no;
    const isChecked = el.checked;
    
    // Find remark input
    const remarkEl = qs(`.modal-chk-remark[data-no="${no}"]`);
    const remark = remarkEl ? remarkEl.value?.trim() : '';
    
    draftData.checklist[no] = {
      val: isChecked,
      remark: remark
    };
  });

  // Save to Local Drafts
  App.draftLogs[catId] = JSON.stringify(draftData);

  toast('✅ Draf checklist berhasil disimpan!', 'success');
  closeModal();

  // Refresh active view to show summary card
  updateDynamicForm(catId);
  refreshCatChips();
}

async function boot() {
  DB.init();
  
  const statusEl = document.querySelector('.loading-status');
  if (statusEl) statusEl.textContent = 'Menghubungkan ke database online...';

  // Sync Supabase online
  const isOnline = await DB.syncFromCloud();
  if (statusEl) {
    statusEl.textContent = isOnline 
      ? 'Terhubung online! Sinkronisasi data selesai.' 
      : 'Bekerja offline (LocalStorage fallback).';
  }

  // Show loading briefly, then render login
  setTimeout(() => {
    renderLogin();
  }, 1000);
}

boot();

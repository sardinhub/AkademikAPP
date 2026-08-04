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
  editSiswaNim: null,// for siswa edit modal
  mentoringStaffId: null, // for mentoring filter selection (legacy)
  selectedRoom: null, // for checklist
  selectedKelas: null, // for kelas mentoring admin panel
  draftLogs: {},     // dynamic draft categories
  activeCat: null,   // active category ID
  currentShift: null, // { shift: 'pagi'|'siang'|null, isActive: bool, label: string }
  logFilter: {       // filter state for Log Aktivitas
    startDate: '',
    endDate: '',
    staffId: '',
    kategori: ''
  },
  rekapFilter: {     // filter state untuk Rekap Absen Mentoring
    tanggal: '',     // akan diisi dengan DB.today() saat pertama buka
    sesi: ''         // '' = Semua, 'pagi', 'malam'
  }
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

// ============================================================
//  SHIFT CONFIG
// ============================================================
const SHIFT_CONFIG = {
  pagi: {
    label:      'Shift Pagi',
    jam_mulai:  '10:00',
    jam_selesai:'13:00',
    emoji:      '🌅',
    colorClass: 'shift-pagi'
  },
  siang: {
    label:      'Shift Siang',
    jam_mulai:  '13:00',
    jam_selesai:'16:00',
    emoji:      '☀️',
    colorClass: 'shift-siang'
  }
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
    const errDetail = DB._lastSyncError ? ` (${DB._lastSyncError})` : '';
    toast(`⚠️ Gagal sinkronisasi${errDetail}. Cek Console (F12).`, 'warning', 6000);
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

        <div id="manager-password-wrap" class="hidden" style="margin-top:12px;">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" for="txt-password">Password Manager <span class="req">*</span></label>
            <input type="password" class="form-control" id="txt-password" placeholder="Masukkan password manager (8989)">
          </div>
        </div>

        <div id="staff-select-wrap" class="staff-name-section hidden">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" for="sel-staff">Nama Staf <span class="req">*</span></label>
            <select class="form-control" id="sel-staff" onchange="onStaffSelectChange()">
              <option value="">— Pilih nama Anda —</option>
              ${activeStaff.map(s => `<option value="${s.id}">${s.nama} — ${s.jabatan}</option>`).join('')}
            </select>
          </div>
          
          <div id="staff-pin-wrap" class="hidden">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" for="txt-pin">PIN Staf (4 Digit) <span class="req">*</span></label>
              <input type="password" class="form-control" id="txt-pin" placeholder="Masukkan 4 digit PIN Anda" inputmode="numeric" maxlength="4" style="letter-spacing: 0.5em; text-align: center; font-weight: bold;">
            </div>
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
  const staffWrap = document.getElementById('staff-select-wrap');
  const mgrWrap = document.getElementById('manager-password-wrap');
  
  if (role === 'staff') {
    staffWrap.classList.remove('hidden');
    mgrWrap.classList.add('hidden');
  } else {
    staffWrap.classList.add('hidden');
    mgrWrap.classList.remove('hidden');
    const pinEl = document.getElementById('txt-pin');
    if (pinEl) pinEl.value = '';
    const selEl = document.getElementById('sel-staff');
    if (selEl) selEl.value = '';
    onStaffSelectChange();
  }
}

function onStaffSelectChange() {
  const selEl = document.getElementById('sel-staff');
  const pinWrap = document.getElementById('staff-pin-wrap');
  if (selEl?.value) {
    pinWrap.classList.remove('hidden');
  } else {
    pinWrap.classList.add('hidden');
    const pinEl = document.getElementById('txt-pin');
    if (pinEl) pinEl.value = '';
  }
}

async function doLogin() {
  const roleEl = document.querySelector('input[name="role"]:checked');
  if (!roleEl) { toast('Pilih peran Anda terlebih dahulu', 'warning'); return; }

  const role = roleEl.value;

  if (role === 'staff') {
    const selEl = document.getElementById('sel-staff');
    if (!selEl?.value) { toast('Pilih nama Anda terlebih dahulu', 'warning'); return; }
    
    const pinEl = document.getElementById('txt-pin');
    const pinVal = pinEl?.value?.trim();
    if (!pinVal) { toast('Masukkan PIN Anda', 'warning'); return; }
    if (pinVal.length !== 4) { toast('PIN harus 4 digit angka', 'warning'); return; }

    const user = DB.getStaffById(selEl.value);
    if (!user) { toast('Data staf tidak ditemukan', 'danger'); return; }
    
    if (user.pin !== pinVal) {
      toast('PIN yang Anda masukkan salah!', 'danger');
      return;
    }

    App.role = 'staff';
    App.user = user;
    // Deteksi shift staf saat login
    App.currentShift = DB.detectCurrentShift(user.id);

    const btn = document.getElementById('btn-masuk');
    if (btn) btn.innerHTML = '⏳ Menghubungkan...';
    await DB.syncFromCloud(true);

    await renderStaffView('tracker');
  } else {
    const passEl = document.getElementById('txt-password');
    const passVal = passEl?.value;
    if (!passVal) { toast('Masukkan password manager', 'warning'); return; }
    if (passVal !== '8989') {
      toast('Password manager salah!', 'danger');
      return;
    }

    App.role = 'admin';
    App.user = { id: 'ADMIN', nama: 'Manager Akademik', jabatan: 'Administrator', status: 'Aktif' };

    const btn = document.getElementById('btn-masuk');
    if (btn) btn.innerHTML = '⏳ Menghubungkan...';
    await DB.syncFromCloud(true);

    await renderAdminView('overview');
  }
}

// ============================================================
//  STAFF SHELL
// ============================================================
async function renderStaffView(tab = 'tracker') {
  const isSabtu = new Date().getDay() === 6;
  if (isSabtu && (tab === 'absen-pagi' || tab === 'absen-malam')) tab = 'absen-sabtu';
  if (!isSabtu && tab === 'absen-sabtu') tab = 'absen-pagi';

  App.tab = tab;
  DB.syncFromCloud().catch(console.error);
  const todayLogs = DB.getStaffLogsToday(App.user.id);

  // Cek kelas mentoring dan siswa staf ini
  const assignedNims = DB.getMentorStudents(App.user.id);
  const kelasId      = DB.getStaffKelasId(App.user.id);
  const kelasInfo    = KELAS_MENTORING.find(k => k.id === kelasId);
  const hasAssignment = kelasId !== null && assignedNims.length > 0;

  // Cek jendela waktu absen
  const pagiOpen  = isAbsenWindowOpen('pagi', kelasId);
  const malamOpen = isAbsenWindowOpen('malam', kelasId);

  // Cek piket hari ini
  const piketHariIni = DB.getPiket({ staffId: App.user.id, tanggal: DB.today() });
  const adaPiket = piketHariIni.length > 0;

  // Cek izin pending
  const izinPending = DB.getIzin({ staffId: App.user.id }).filter(i => i.status === 'Menunggu').length;

  const tabs = [
    { id: 'tracker',   emoji: '⏱️', label: 'Log Aktivitas',
      badge: `<span class="log-bubble">${todayLogs.length}</span>` },
    { id: 'checklist', emoji: '✅', label: 'Checklist Kelas', badge: '' },
    ...(hasAssignment ? (isSabtu ? [
      { id: 'absen-sabtu', emoji: '🟡',
        label: `Absen Sabtu${kelasInfo ? ' ' + kelasInfo.icon : ''}`,
        badge: isAbsenWindowOpen('sabtu', kelasId) ? '<span class="badge badge-success" style="margin-left:4px;font-size:9px;">BUKA</span>' : '' }
    ] : [
      { id: 'absen-pagi',  emoji: '🌅',
        label: `Absen Pagi${kelasInfo ? ' ' + kelasInfo.icon : ''}`,
        badge: pagiOpen  ? '<span class="badge badge-success" style="margin-left:4px;font-size:9px;">BUKA</span>' : '' },
      { id: 'absen-malam', emoji: '🌙',
        label: `Absen Malam${kelasInfo ? ' ' + kelasInfo.icon : ''}`,
        badge: malamOpen ? '<span class="badge badge-success" style="margin-left:4px;font-size:9px;">BUKA</span>' : '' }
    ]) : []),
    { id: 'piket-saya',  emoji: '🗓️', label: 'Jadwal Piket',
      badge: adaPiket ? '<span class="badge badge-warning" style="margin-left:4px;font-size:9px;">PIKET</span>' : '' },
    { id: 'nilai-saya',  emoji: '⭐', label: 'Nilai Saya', badge: '' },
    { id: 'izin-saya',   emoji: '📝', label: 'Pengajuan Izin',
      badge: izinPending > 0 ? `<span class="log-bubble">${izinPending}</span>` : '' }
  ];

  const tabsHtml = tabs.map(t => `
    <button id="tab-${t.id}" class="tab-btn ${tab === t.id ? 'active' : ''}"
      onclick="renderStaffView('${t.id}')">
      <span class="tab-emoji">${t.emoji}</span>${t.label}${t.badge}
    </button>`).join('');

  let tabContent = '';
  if (tab === 'tracker')     tabContent = buildTracker();
  else if (tab === 'checklist') tabContent = buildChecklist();
  else if (tab === 'absen-pagi')  tabContent = buildMentoringAbsen('pagi');
  else if (tab === 'absen-malam') tabContent = buildMentoringAbsen('malam');
  else if (tab === 'absen-sabtu') tabContent = buildMentoringAbsen('sabtu');
  else if (tab === 'piket-saya')  tabContent = buildPiketSaya();
  else if (tab === 'nilai-saya')  tabContent = buildNilaiSaya();
  else if (tab === 'izin-saya')   tabContent = buildIzinSaya();

  // Banner pengumuman aktif
  const pengumuman = DB.getPengumuman();
  const bannerHtml = pengumuman.length > 0 ? `
    <div class="pengumuman-banner-wrap">
      ${pengumuman.slice(0, 3).map(p => `
        <div class="pengumuman-banner peng-${p.tipe}">
          <span class="peng-icon">${p.tipe === 'warning' ? '⚠️' : p.tipe === 'danger' ? '🚨' : 'ℹ️'}</span>
          <div class="peng-text"><strong>${p.judul}</strong> — ${p.isi}</div>
          <span class="peng-time">${new Date(p.created_at).toLocaleDateString('id-ID', {day:'2-digit',month:'short'})}</span>
        </div>
      `).join('')}
    </div>` : '';

  $app().innerHTML = `
    <div class="app-layout">
      ${renderHeader()}
      <main class="app-content">
        ${bannerHtml}
        <div class="tab-nav">${tabsHtml}</div>
        <div class="tab-content anim-in" id="tab-body">
          ${tabContent}
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
            if (data && data.no_dosen) {
              const alasan = data.alasan_no_dosen || 'Tidak diketahui';
              const subjek = data.subject_no_dosen ? ` · ${data.subject_no_dosen}` : '';
              desc = `⚠️ <strong style="color:var(--warning);">Tanpa Dosen</strong>${subjek} · Alasan: <em>${alasan}</em> · ${data.aktivitas_staff || '—'}`;
            } else if (data && data.metadata) {
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
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <p class="page-sub" style="margin:0;">Catat aktivitas per jam · ${formatDateLong(today)}</p>
        ${(() => {
          const sc = App.currentShift;
          // 1. Jika ada shift HARI INI
          if (sc && sc.shift) {
            const cfg = SHIFT_CONFIG[sc.shift];
            return `<span class="shift-badge ${cfg.colorClass}${sc.isActive ? ' shift-active' : ' shift-inactive'}">
              ${cfg.emoji} ${cfg.label} &nbsp;·&nbsp; ${cfg.jam_mulai}–${cfg.jam_selesai}
              ${sc.isActive ? '<span class="shift-dot-live"></span>' : '<span class="shift-off-label">Di luar jam</span>'}
            </span>`;
          }
          
          // 2. Jika tidak ada shift hari ini, cek apakah ada shift BESOK
          const tmr = new Date();
          tmr.setDate(tmr.getDate() + 1);
          // Hati-hati zona waktu saat toISOString
          const y = tmr.getFullYear();
          const m = String(tmr.getMonth() + 1).padStart(2, '0');
          const d = String(tmr.getDate()).padStart(2, '0');
          const besokIso = `${y}-${m}-${d}`;
          
          const shiftBesok = DB.getShiftStaffByDate(App.user.id, besokIso);
          if (shiftBesok) {
            const cfg = SHIFT_CONFIG[shiftBesok];
            return `<span class="shift-badge" style="background: rgba(255,255,255,0.03); color: var(--text-muted); border: 1px dashed var(--border-xs);">
              📅 Jadwal Anda Besok: <strong>${cfg.emoji} ${cfg.label}</strong>
            </span>`;
          }
          
          return '';
        })()}
      </div>
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
  const savedLogs = jam 
    ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam)
    : [];
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
  const mySavedLogs = jam ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam) : [];
  const allSavedLogs = jam ? DB.getLogs({ tanggal: DB.today() }).filter(l => l.jam === jam) : [];

  qsa('.cat-chip').forEach(chip => {
    const catId = chip.dataset.id;
    const logsToSearch = mySavedLogs;
    const savedLog = logsToSearch.find(l => l.kategori === catId);
    const isSaved = !!savedLog;
    
    // Check if class is closed
    let isClosed = false;
    if (isSaved && savedLog && catId.startsWith('kesiapan-')) {
      try {
        const data = JSON.parse(savedLog.deskripsi);
        if (data.is_closed || data.no_dosen) isClosed = true;
      } catch (e) {}
    } else if (isSaved) {
      isClosed = true;
    }

    const isFilled = App.draftLogs && App.draftLogs[catId] && App.draftLogs[catId].trim() !== '';
    const isActive = App.activeCat === catId;
    
    chip.classList.toggle('active', isActive);
    chip.classList.toggle('filled', isFilled && !isSaved);
    
    chip.classList.toggle('ongoing', isSaved && !isClosed);
    chip.classList.toggle('saved', isSaved && isClosed);
    
    const cat = DB.getCategory(catId);
    let extra = '';
    if (isSaved) {
      if (isClosed) {
        extra = ' <span class="chip-saved-badge">🔒 Selesai</span>';
      } else {
        extra = ' <span class="chip-ongoing-badge">⏳ Berjalan</span>';
      }
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
  const savedLogs = jam 
    ? DB.getLogs({ staffId: App.user.id, tanggal: DB.today() }).filter(l => l.jam === jam)
    : [];
  const savedLog = savedLogs.find(l => l.kategori === catId);
  const isSaved = !!savedLog;
  
  let isClosed = false;
  if (isSaved && savedLog && catId.startsWith('kesiapan-')) {
    try {
      const data = JSON.parse(savedLog.deskripsi);
      if (data.is_closed || data.no_dosen) isClosed = true;
    } catch(e) {}
  }

  let badgeHtml = '<span class="req">*</span>';
  if (isSaved) {
    if (catId.startsWith('kesiapan-')) {
      badgeHtml = isClosed 
        ? '<span class="badge badge-success" style="margin-left:8px; background:var(--info-bg); color:var(--info); border:1px solid var(--info-border);">Selesai</span>' 
        : '<span class="badge badge-warning" style="margin-left:8px; background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border);">Berjalan</span>';
    } else {
      badgeHtml = '<span class="badge badge-success" style="margin-left:8px;">Terkirim</span>';
    }
  }
  label.innerHTML = `${cat.name} ${badgeHtml}`;

  const draftVal = isSaved ? savedLog.deskripsi : (App.draftLogs[catId] || '');
  const dis = isSaved ? 'disabled' : '';

  if (catId.startsWith('kesiapan-')) {
    let data = null;
    try {
      if (draftVal) data = JSON.parse(draftVal);
    } catch(e) {}

    const isNoDosen = data && data.no_dosen === true;

    hint.textContent = isSaved 
      ? (isNoDosen ? 'Aktivitas manual tercatat (dosen tidak hadir).' : isClosed ? 'Checklist kelas sudah selesai & dikunci.' : 'Kelas sedang berjalan. Anda bisa memperbarui jam akhir dosen.') 
      : 'Isi checklist kesiapan ruangan dan pengecekan kedisiplinan siswa.';
      
    let summaryHtml = '';
    if (data && isNoDosen) {
      summaryHtml = `
        <div style="background:rgba(234,179,8,0.06); border:1px solid rgba(234,179,8,0.25); border-radius:var(--r-md); padding:14px; margin-bottom:12px; font-size:13px; text-align:left;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="font-size:18px;">⚠️</span>
            <strong style="color:var(--warning); font-size:14px;">Dosen Tidak Hadir</strong>
          </div>
          ${data.subject_no_dosen ? `<div style="margin-bottom:5px;"><strong>Mata Kuliah:</strong> ${data.subject_no_dosen}</div>` : ''}
          ${data.nama_dosen_absen ? `<div style="margin-bottom:5px;"><strong>Dosen Absen:</strong> ${data.nama_dosen_absen}</div>` : ''}
          <div style="margin-bottom:5px;"><strong>Alasan:</strong> <span style="color:var(--warning);">${data.alasan_no_dosen || '—'}</span></div>
          <div style="margin-bottom:5px;"><strong>Aktivitas Staf:</strong> ${data.aktivitas_staff || '—'}</div>
          ${data.catatan ? `<div style="margin-bottom:5px;"><strong>Catatan:</strong> ${data.catatan}</div>` : ''}
        </div>`;
    } else if (data && data.metadata) {
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

    let btnLabel = isNoDosen
      ? (isSaved ? '📋 Lihat Laporan Aktivitas' : '📝 Buka Form Aktivitas Manual')
      : (isSaved ? (isClosed ? '📋 Lihat Checklist (Selesai)' : '📝 Edit / Close Class') : '📋 Buka Formulir Checklist / Mode Dosen Absen');

    container.innerHTML = `
      ${summaryHtml}
      <button class="btn btn-gold btn-full" onclick="openClassChecklistModal('${catId}')" style="margin-top:6px;">
        ${btnLabel}
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
    const hasLog = DB.isCategoryLogged(App.user.id, DB.today(), jam, catId);

    if (hasLog) {
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
  DB.syncFromCloud().catch(console.error);

  const tabs = [
    { id: 'overview',        emoji: '📊', label: 'Dashboard'         },
    { id: 'staff',           emoji: '👥', label: 'Master Staf'       },
    { id: 'siswa',           emoji: '🎓', label: 'Siswa Aktif'       },
    { id: 'kelas-mentoring', emoji: '🏨', label: 'Kelas Mentoring'   },
    { id: 'waktu-absen',     emoji: '⏰', label: 'Waktu Absen'       },
    { id: 'rekap-absen',     emoji: '📅', label: 'Rekap Absen'       },
    { id: 'jadwal-shift',    emoji: '🕐', label: 'Jadwal Shift'      },
    { id: 'logs',            emoji: '📋', label: 'Log Aktivitas'     },
    { id: 'issues',          emoji: '⚠️', label: 'Laporan Kendala'  },
    { id: 'pengumuman',      emoji: '📢', label: 'Pengumuman'        },
    { id: 'statistik',       emoji: '📈', label: 'Statistik'         },
    { id: 'penilaian',       emoji: '⭐', label: 'Penilaian'         },
    { id: 'jadwal-piket',    emoji: '🗓️', label: 'Jadwal Piket'     },
    { id: 'permohonan-izin', emoji: '📝', label: 'Permohonan Izin'   }
  ];

  const tabsHtml = tabs.map(t => `
    <button class="tab-btn ${tab === t.id ? 'active' : ''}" onclick="renderAdminView('${t.id}')">
      <span class="tab-emoji">${t.emoji}</span>${t.label}
    </button>`).join('');

  const content = {
    overview:          buildOverview,
    staff:             buildStaffMgmt,
    siswa:             buildSiswaView,
    'kelas-mentoring': buildKelasMentoringView,
    'waktu-absen':     buildWaktuAbsenView,
    'rekap-absen':     buildRekapAbsenView,
    'jadwal-shift':    buildJadwalShiftView,
    logs:              buildLogsView,
    issues:            buildIssueAlerts,
    pengumuman:        buildPengumumanView,
    statistik:         buildStatistikView,
    penilaian:         buildPenilaianView,
    'jadwal-piket':    buildJadwalPiketView,
    'permohonan-izin': buildIzinAdminView
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

  // Init chart setelah DOM siap
  if (tab === 'statistik') {
    setTimeout(() => initCharts(), 100);
  }
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

  // Logs dengan dosen tidak hadir hari ini
  const noDossenLogs = logs.filter(l => {
    try {
      if (l.deskripsi && l.deskripsi.startsWith('{')) {
        const d = JSON.parse(l.deskripsi);
        return d.no_dosen === true;
      }
    } catch(e) {}
    return false;
  });

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
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <p class="page-sub" style="margin:0;">Pantau status staf dan kesiapan kelas · ${formatDateLong(today)}</p>
        <button class="btn btn-warning btn-sm" onclick="downloadLocalBackup()" style="font-size:12px; font-weight:bold;">
          💾 Download Backup Data
        </button>
      </div>
    </div>

    ${statsHtml}

    ${noDossenLogs.length > 0 ? `
    <div class="card" style="margin-bottom:var(--sp-4); border-color:rgba(234,179,8,0.3); background:rgba(234,179,8,0.03);">
      <div class="card-header" style="border-color:rgba(234,179,8,0.2);">
        <div class="card-title" style="color:var(--warning);">⚠️ Laporan Ketidakhadiran Dosen Hari Ini</div>
        <span class="badge badge-warning">${noDossenLogs.length} kejadian</span>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Staf</th><th>Jam</th><th>Mata Kuliah</th><th>Alasan</th><th>Aktivitas Staf</th></tr></thead>
          <tbody>
            ${noDossenLogs.map(l => {
              let nd = {};
              try { nd = JSON.parse(l.deskripsi); } catch(e) {}
              const st = staff.find(s => s.id === l.staff_id);
              return `<tr>
                <td><div class="name-cell"><div class="av av-sm">${DB.getInitials(st?.nama || l.staff_nama || '?')}</div><span class="td-strong">${st?.nama || l.staff_nama}</span></div></td>
                <td><span class="badge badge-warning">${l.jam}</span></td>
                <td style="font-size:12px;">${nd.subject_no_dosen || '\u2014'}</td>
                <td><span style="font-size:12px; color:var(--warning);">${nd.alasan_no_dosen || '\u2014'}</span></td>
                <td style="font-size:12px; color:var(--text-muted); max-width:220px; white-space:normal;">${nd.aktivitas_staff || '\u2014'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

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
      // Handle no_dosen (dosen tidak hadir) mode first
      if (structData.no_dosen) {
        listHtml += `
          <div style="background:rgba(234,179,8,0.05); border:1px solid rgba(234,179,8,0.22); border-radius:var(--r-md); padding:14px; margin-bottom:12px; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px; margin-bottom:10px;">
              <div style="font-weight:700; color:var(--warning); font-size:14px; display:flex; align-items:center; gap:6px;">
                ⚠️ <span>${cat.name}</span>
                <span class="badge badge-warning" style="font-size:9px; padding:2px 6px; margin-left:4px;">Tanpa Dosen</span>
              </div>
              <span class="badge badge-ghost" style="font-size:10px;">${sentTime}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px; color:var(--text-secondary);">
              <div>
                ${structData.subject_no_dosen ? `<div style="margin-bottom:4px;"><strong>Mata Kuliah:</strong> ${structData.subject_no_dosen}</div>` : ''}
                ${structData.nama_dosen_absen ? `<div style="margin-bottom:4px;"><strong>Dosen Absen:</strong> ${structData.nama_dosen_absen}</div>` : ''}
                <div><strong>Alasan:</strong> <span style="color:var(--warning);">${structData.alasan_no_dosen || '—'}</span></div>
              </div>
              <div>
                <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Aktivitas Staf:</div>
                <div style="line-height:1.5;">${structData.aktivitas_staff || '—'}</div>
              </div>
            </div>
            ${structData.catatan ? `<div style="margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); font-size:12px;"><strong>Catatan:</strong> ${structData.catatan}</div>` : ''}
            <div style="margin-top:8px; font-size:10px; color:var(--text-muted);">Dicatat oleh: ${structData.recorded_by_nama || log.staff_nama}</div>
          </div>`;
        return; // skip checklist rendering for no_dosen logs
      }
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

      const isClosed = structData.is_closed || false;
      let statusBadge = isClosed 
        ? `<span class="badge badge-success" style="font-size:10px; background:var(--info-bg); color:var(--info); border:1px solid var(--info-border); ${App.role === 'admin' ? 'cursor:pointer;' : ''}" ${App.role === 'admin' ? `onclick="closeModal(); openClassChecklistModal('${cat.id}', '${jam}', '${staffId}')" title="Klik untuk mengedit checklist ini"` : ''}>🔒 Selesai</span>` 
        : '<span class="badge badge-warning" style="font-size:10px; background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border);">⏳ Berjalan</span>';

      if (isClosed && structData.closed_by_nama) {
        statusBadge += ` <span style="font-size:10px; color:var(--text-muted); margin-left:6px;">(ditutup oleh ${structData.closed_by_nama})</span>`;
      }

      listHtml += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-xs); border-radius:var(--r-md); padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px; margin-bottom:10px;">
            <div style="font-weight:700; color:var(--text-primary); font-size:14px; display:flex; align-items:center; gap:6px;">
              <span>🏫</span> <span>${cat.name}</span> ${statusBadge}
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
      <td class="text-sm">
        <span class="staff-pin-container" data-id="${s.id}" data-pin="${s.pin || '1234'}">
          <span class="pin-stars">••••</span>
          <button class="btn-icon-sm" onclick="togglePinReveal('${s.id}')" title="Tampilkan PIN" style="background:transparent; border:none; color:var(--gold-light); cursor:pointer; margin-left:6px; font-size:11px;">👁️</button>
        </span>
      </td>
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
          <button class="btn btn-danger btn-sm" onclick="deleteStaffLogsUI('${s.id}', '${s.nama.replace(/'/g, "\\'")}')" title="Hapus seluruh log staf ini">🗑️ Hapus Log</button>
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
              <th>PIN Login</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
//  FEATURE: SISWA AKTIF (Admin)
// ============================================================
function buildSiswaView() {
  const all = DB.getAllSiswa();

  const rows = all.map(s => `
    <tr>
      <td class="text-xs text-muted">${s.nim}</td>
      <td>
        <div class="name-cell">
          <div class="av av-sm" style="background:linear-gradient(135deg,var(--gold),var(--gold-dark));">${DB.getInitials(s.nama)}</div>
          <span class="td-strong">${s.nama}</span>
        </div>
      </td>
      <td><span class="badge badge-info" style="font-size:11px;">${s.kelas}</span></td>
      <td><span style="font-size:12px; color:var(--text-secondary);">${s.program}</span></td>
      <td>
        <span class="badge ${s.status === 'Aktif' ? 'badge-success' : 'badge-ghost'}">
          <span class="dot ${s.status === 'Aktif' ? 'dot-success' : 'dot-muted'}"></span>
          ${s.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="openEditSiswa('${s.nim}')">✏️ Edit</button>
          <button class="btn ${s.status === 'Aktif' ? 'btn-danger' : 'btn-success'} btn-sm"
            onclick="toggleSiswaUI('${s.nim}')">
            ${s.status === 'Aktif' ? '🔴 Nonaktifkan' : '🟢 Aktifkan'}
          </button>
          <button class="btn btn-delete btn-sm" onclick="deleteSiswaUI('${s.nim}', '${s.nama.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">🎓 Daftar Siswa Aktif</h2>
      <p class="page-sub">Kelola data siswa · ${all.length} siswa terdaftar</p>
    </div>

    <div class="staff-toolbar">
      <button class="btn btn-primary" onclick="openAddSiswa()">➕ Tambah Siswa</button>
      <button class="btn btn-gold" onclick="openImportExcel()">📥 Import Excel</button>
      <a class="btn btn-ghost btn-sm" href="data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${getTemplateBase64()}" download="template_siswa_TIA.xlsx" style="display:inline-flex;align-items:center;gap:6px;">
        📄 Unduh Template
      </a>
    </div>

    <!-- Hidden file input for Excel import -->
    <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display:none;"
      onchange="handleExcelFile(event)">

    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>NIM</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>Program</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">Belum ada data siswa. Klik Tambah Siswa atau Import Excel untuk memulai.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function siswaModal({ title, nim = '', nama = '', kelas = '', program = '', nimDisabled = false }) {
  const kelasOpts = KELAS_OPTIONS.map(k =>
    `<option value="${k}" ${kelas === k ? 'selected' : ''}>${k}</option>`
  ).join('');
  const progOpts = PROGRAM_OPTIONS.map(p =>
    `<option value="${p}" ${program === p ? 'selected' : ''}>${p}</option>`
  ).join('');

  openModal(`
    <div class="modal-box">
      <div class="modal-hd">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="s-nim">NIM <span class="req">*</span></label>
          <input type="text" class="form-control" id="s-nim" value="${nim}"
            placeholder="Contoh: TIA2024001" ${nimDisabled ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label class="form-label" for="s-nama">Nama Lengkap <span class="req">*</span></label>
          <input type="text" class="form-control" id="s-nama" value="${nama}"
            placeholder="Contoh: Budi Santoso">
        </div>
        <div class="form-group">
          <label class="form-label" for="s-kelas">Kelas <span class="req">*</span></label>
          <select class="form-control" id="s-kelas">
            <option value="">— Pilih Kelas —</option>
            ${kelasOpts}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="s-program">Program Studi <span class="req">*</span></label>
          <select class="form-control" id="s-program">
            <option value="">— Pilih Program —</option>
            ${progOpts}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveSiswa()">💾 Simpan</button>
      </div>
    </div>`);
}

function openAddSiswa() {
  App.editSiswaNim = null;
  siswaModal({ title: '➕ Tambah Siswa Baru' });
}

function openEditSiswa(nim) {
  const s = DB.getSiswaByNim(nim);
  if (!s) return;
  App.editSiswaNim = nim;
  siswaModal({ title: '✏️ Edit Data Siswa', nim: s.nim, nama: s.nama, kelas: s.kelas, program: s.program, nimDisabled: true });
}

async function saveSiswa() {
  const nim     = qs('#s-nim')?.value?.trim();
  const nama    = qs('#s-nama')?.value?.trim();
  const kelas   = qs('#s-kelas')?.value;
  const program = qs('#s-program')?.value;
  if (!nim)     { toast('NIM tidak boleh kosong', 'warning');         return; }
  if (!nama)    { toast('Nama tidak boleh kosong', 'warning');         return; }
  if (!kelas)   { toast('Pilih kelas siswa', 'warning');              return; }
  if (!program) { toast('Pilih program studi', 'warning');            return; }

  try {
    if (App.editSiswaNim) {
      await DB.updateSiswa(App.editSiswaNim, { nama, kelas, program });
      toast(`✅ Data ${nama} diperbarui!`, 'success');
    } else {
      await DB.addSiswa({ nim, nama, kelas, program });
      toast(`✅ Siswa ${nama} ditambahkan!`, 'success');
    }
  } catch (err) {
    toast(err.message || 'Gagal menyimpan data siswa', 'danger');
    return;
  }
  closeModal();
  await renderAdminView('siswa');
}

async function toggleSiswaUI(nim) {
  const s = DB.getSiswaByNim(nim);
  if (!s) return;
  const act = s.status === 'Aktif' ? 'menonaktifkan' : 'mengaktifkan';
  if (!confirm(`Anda yakin ingin ${act} siswa ${s.nama}?`)) return;
  await DB.toggleSiswaStatus(nim);
  toast(`✅ Status ${s.nama} berhasil diubah!`, 'success');
  await renderAdminView('siswa');
}

async function deleteSiswaUI(nim, nama) {
  if (!confirm(`⚠️ HAPUS PERMANEN\n\nAnda akan menghapus siswa:\n"${nama}" — NIM: ${nim}\n\nData yang sudah terhapus tidak dapat dipulihkan. Lanjutkan?`)) return;
  await DB.deleteSiswa(nim);
  toast(`🗑️ Siswa "${nama}" berhasil dihapus.`, 'warning');
  await renderAdminView('siswa');
}

// ============================================================
//  IMPORT EXCEL SISWA
// ============================================================

/**
 * Buat base64 template Excel minimal (header: NIM, Nama, Kelas, Program)
 * agar user bisa unduh format yang benar.
 */
function getTemplateBase64() {
  if (typeof XLSX === 'undefined') return '';
  try {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['NIM', 'Nama', 'Kelas', 'Program'],
      ['TIA2024001', 'Contoh Nama Siswa', 'Garuda A', 'Ground Handling'],
      ['TIA2024002', 'Contoh Nama 2',    'Citilink B', 'Cabin Crew']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Set column widths
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
    return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  } catch(e) {
    return '';
  }
}

/** Buka file picker Excel */
function openImportExcel() {
  const inp = document.getElementById('excel-file-input');
  if (!inp) { toast('Komponen import tidak ditemukan, coba refresh halaman.', 'danger'); return; }
  inp.value = ''; // reset agar event onchange selalu terpicu
  inp.click();
}

/** Dipanggil saat user memilih file */
function handleExcelFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    toast('⚠️ Library SheetJS belum dimuat. Periksa koneksi internet Anda.', 'danger');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data    = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet   = workbook.Sheets[workbook.SheetNames[0]];
      const rows    = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows || rows.length === 0) {
        toast('⚠️ File Excel kosong atau tidak ada data.', 'warning');
        return;
      }

      // Normalisasi header (case-insensitive, trim whitespace)
      const normalize = (str) => String(str || '').trim().toLowerCase();
      const firstRow = rows[0];
      const headers  = Object.keys(firstRow).map(normalize);

      // Cari kolom yang cocok
      const colMap = {};
      for (const key of Object.keys(firstRow)) {
        const n = normalize(key);
        if (n.includes('nim') || n.includes('nomor induk'))  colMap.nim     = key;
        if (n.includes('nama'))                               colMap.nama    = key;
        if (n.includes('kelas') || n.includes('class'))      colMap.kelas   = key;
        if (n.includes('program') || n.includes('prodi') || n.includes('jurusan')) colMap.program = key;
      }

      const missing = ['nim','nama','kelas','program'].filter(k => !colMap[k]);
      if (missing.length > 0) {
        toast(`⚠️ Kolom tidak ditemukan di Excel: ${missing.join(', ')}. Pastikan header sesuai template.`, 'danger');
        return;
      }

      // Buat array siswa dari baris Excel
      const siswaParsed = rows
        .map((row, idx) => ({
          _rowNum: idx + 2, // baris di Excel (1=header)
          nim:     String(row[colMap.nim]     || '').trim(),
          nama:    String(row[colMap.nama]    || '').trim(),
          kelas:   String(row[colMap.kelas]   || '').trim(),
          program: String(row[colMap.program] || '').trim()
        }))
        .filter(s => s.nim && s.nama); // buang baris kosong

      if (siswaParsed.length === 0) {
        toast('⚠️ Tidak ada baris data valid yang ditemukan.', 'warning');
        return;
      }

      openImportPreviewModal(siswaParsed, file.name);
    } catch(err) {
      console.error('Excel parse error:', err);
      toast('❌ Gagal membaca file Excel. Pastikan format file benar (.xlsx/.xls).', 'danger');
    }
  };
  reader.readAsArrayBuffer(file);
}

/** Tampilkan modal preview sebelum import */
function openImportPreviewModal(siswaList, fileName) {
  const existingNims = new Set(DB.getAllSiswa().map(s => s.nim));
  const validKelas   = new Set(KELAS_OPTIONS);
  const validProg    = new Set(PROGRAM_OPTIONS);

  let dupCount    = 0;
  let invalidCount = 0;

  const rowsHtml = siswaList.map((s, i) => {
    const isDup     = existingNims.has(s.nim);
    const badKelas  = s.kelas   && !validKelas.has(s.kelas);
    const badProg   = s.program && !validProg.has(s.program);
    const hasIssue  = isDup || badKelas || badProg;
    const isInvalid = !s.nim || !s.nama;

    if (isDup)     dupCount++;
    if (hasIssue)  invalidCount++;

    let statusBadge = '';
    const issues = [];
    if (isDup)     issues.push('NIM duplikat');
    if (badKelas)  issues.push(`Kelas tidak dikenal: "${s.kelas}"`);
    if (badProg)   issues.push(`Program tidak dikenal: "${s.program}"`);

    if (issues.length > 0) {
      statusBadge = `<span class="badge badge-warning" style="font-size:9px;">⚠️ ${issues.join(' · ')}</span>`;
    } else {
      statusBadge = '<span class="badge badge-success" style="font-size:9px;">✓ OK</span>';
    }

    return `<tr style="${isDup ? 'opacity:0.5;' : ''}">
      <td class="text-xs" style="color:var(--text-muted);">${s._rowNum}</td>
      <td class="text-xs">
        <input type="checkbox" class="import-chk" data-idx="${i}" ${isDup ? '' : 'checked'}
          style="accent-color:var(--primary); margin-right:4px;">
        ${s.nim}
      </td>
      <td class="text-sm">${s.nama}</td>
      <td><span class="badge badge-info" style="font-size:10px;">${s.kelas || '<em style="color:var(--text-muted)">—</em>'}</span></td>
      <td style="font-size:11px; color:var(--text-secondary);">${s.program || '<em style="color:var(--text-muted)">—</em>'}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');

  const newCount = siswaList.length - dupCount;

  openModal(`
    <div class="modal-box" style="max-width:900px; width:96%;">
      <div class="modal-hd">
        <div style="text-align:left;">
          <h3 class="modal-title">📥 Preview Import Excel</h3>
          <span style="font-size:11px; color:var(--text-muted);">${fileName} · ${siswaList.length} baris ditemukan</span>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="padding:0;">
        <!-- Summary bar -->
        <div class="import-summary-bar">
          <div class="isb-item isb-total">📤 Total <strong>${siswaList.length}</strong></div>
          <div class="isb-item isb-new">➕ Baru <strong>${newCount}</strong></div>
          <div class="isb-item isb-dup">🔄 Duplikat <strong>${dupCount}</strong></div>
          <div class="isb-item isb-warn">⚠️ Perlu Perhatian <strong>${invalidCount}</strong></div>
        </div>
        <!-- Info banner -->
        <div style="padding:12px 20px; font-size:12px; color:var(--text-muted); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--border-xs);">
          ℹ️ Centang baris yang ingin diimport. Baris <strong>duplikat NIM</strong> otomatis tidak dicentang. Kelas/Program yang tidak sesuai daftar akan diimpor apa adanya.
        </div>
        <!-- Preview table -->
        <div style="max-height:360px; overflow-y:auto;">
          <table class="tbl" style="font-size:12px;">
            <thead>
              <tr>
                <th style="width:40px;">Baris</th>
                <th>NIM</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Program</th>
                <th style="width:160px;">Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-ghost btn-sm" onclick="toggleImportAll(true)">Pilih Semua</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleImportAll(false)">Batal Semua</button>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button class="btn btn-gold" onclick="confirmImportSiswa(${JSON.stringify(siswaList).replace(/"/g, '&quot;')})">
            📥 Import yang Dicentang
          </button>
        </div>
      </div>
    </div>`);
}

/** Toggle semua checkbox import */
function toggleImportAll(state) {
  document.querySelectorAll('.import-chk').forEach(cb => cb.checked = state);
}

/** Eksekusi import batch untuk baris yang dicentang */
async function confirmImportSiswa(siswaList) {
  const checkedIdxs = [...document.querySelectorAll('.import-chk:checked')].map(cb => parseInt(cb.dataset.idx));
  if (checkedIdxs.length === 0) {
    toast('⚠️ Tidak ada baris yang dicentang untuk diimport.', 'warning');
    return;
  }

  const btn = document.querySelector('.modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Mengimport...'; }

  let success = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const idx of checkedIdxs) {
    const s = siswaList[idx];
    if (!s) continue;
    try {
      await DB.addSiswa({ nim: s.nim, nama: s.nama, kelas: s.kelas, program: s.program });
      success++;
    } catch(err) {
      if (err.message && err.message.includes('sudah terdaftar')) {
        skipped++;
      } else {
        failed++;
        errors.push(`${s.nim}: ${err.message}`);
      }
    }
  }

  closeModal();

  let msg = `✅ ${success} siswa berhasil diimport!`;
  let type = 'success';
  if (skipped > 0) { msg += ` ${skipped} dilewati (duplikat NIM).`; type = 'info'; }
  if (failed  > 0) { msg += ` ${failed} gagal.`; type = 'warning'; }

  toast(msg, type, 5000);
  await renderAdminView('siswa');
}

// ============================================================
//  FEATURE: KELAS MENTORING (Admin) — replaces Filter Mentoring
// ============================================================
function buildKelasMentoringView() {
  const activeStaff      = DB.getActiveStaff();
  const activeSiswa      = DB.getActiveSiswa();
  const selectedKelasId  = App.selectedKelas || KELAS_MENTORING[0].id;
  const selectedKm       = KELAS_MENTORING.find(k => k.id === selectedKelasId);

  /* -- 4 Summary Cards -- */
  const kelasCardsHtml = KELAS_MENTORING.map(km => {
    const mentor     = activeStaff.find(s => DB.getStaffKelasId(s.id) === km.id);
    const siswaCount = DB.getSiswaByKelasId(km.id).length;
    const isActive   = selectedKelasId === km.id;
    return `
      <div class="km-card ${isActive ? 'active' : ''}" onclick="selectKelasCard('${km.id}')"
           style="--km-accent: ${km.accent};">
        <div class="km-card-icon">${km.icon}</div>
        <div class="km-card-name">${km.nama}</div>
        <div class="km-card-stats">
          <div class="km-stat">
            <span class="km-stat-icon">👤</span>
            <span>${mentor ? mentor.nama.split(' ').slice(0,2).join(' ') : '<em style="color:var(--text-muted)">Belum ada mentor</em>'}</span>
          </div>
          <div class="km-stat">
            <span class="km-stat-icon">🎓</span>
            <span>${siswaCount} siswa</span>
          </div>
        </div>
        ${isActive ? '<div class="km-card-active-bar"></div>' : ''}
      </div>`;
  }).join('');

  /* -- Detail Panel untuk kelas yang dipilih -- */
  const assignedStaff    = activeStaff.find(s => DB.getStaffKelasId(s.id) === selectedKelasId);
  const assignedStaffId  = assignedStaff?.id || '';
  const assignedNims     = DB.getSiswaByKelasId(selectedKelasId);

  const staffOpts = `<option value="">— Tidak ada mentor —</option>` +
    activeStaff.map(s => {
      const currentKelasId = DB.getStaffKelasId(s.id);
      const otherKelas = currentKelasId && currentKelasId !== selectedKelasId
        ? KELAS_MENTORING.find(k => k.id === currentKelasId) : null;
      return `<option value="${s.id}" ${assignedStaffId === s.id ? 'selected' : ''}>${s.nama} — ${s.jabatan}${otherKelas ? ` (${otherKelas.icon} ${otherKelas.nama})` : ''}</option>`;
    }).join('');

  const siswaRows = activeSiswa.length === 0
    ? `<div class="empty-state" style="padding:32px;">
         <div class="empty-big">🎓</div>
         <p>Belum ada siswa aktif. Tambahkan di tab <strong>Siswa Aktif</strong>.</p>
       </div>`
    : activeSiswa.map(s => {
        const isChecked    = assignedNims.includes(s.nim);
        const siswaKelasId = DB.getSiswaKelasId(s.nim);
        const otherKelas   = siswaKelasId && siswaKelasId !== selectedKelasId
          ? KELAS_MENTORING.find(k => k.id === siswaKelasId) : null;
        return `
          <label class="mentor-assign-row ${isChecked ? 'assigned' : ''}" for="skm-${s.nim}">
            <input type="checkbox" id="skm-${s.nim}" class="siswa-kelas-chk" value="${s.nim}" ${isChecked ? 'checked' : ''}>
            <div class="ma-info">
              <div class="ma-nama">${s.nama}</div>
              <div class="ma-meta">${s.nim} · ${s.kelas} · ${s.program}
                ${otherKelas ? `<span style="color:var(--warning);margin-left:4px;">⚠ ${otherKelas.icon} ${otherKelas.nama}</span>` : ''}
              </div>
            </div>
            <span class="ma-badge ${isChecked ? 'assigned' : ''}">${isChecked ? `${selectedKm.icon} Diassign` : 'Belum'}</span>
          </label>`;
      }).join('');

  const mentorBanner = assignedStaffId
    ? `<div class="banner banner-info" style="font-size:12px; margin-bottom:12px;">
         📌 Mentor aktif: <strong>${assignedStaff.nama}</strong> (${assignedStaff.jabatan})<br>
         <span style="color:var(--text-muted); font-size:11px;">Seluruh siswa di kelas ini otomatis muncul di daftar hadir staf ini.</span>
       </div>`
    : `<div class="banner banner-warning" style="font-size:12px; margin-bottom:12px;">
         ⚠️ Kelas ini belum memiliki mentor. Pilih staf di bawah.
       </div>`;

  return `
    <div class="page-hd">
      <h2 class="page-title">🏨 Kelas Mentoring</h2>
      <p class="page-sub">Kelola assignment mentor dan siswa per kelas · ${KELAS_MENTORING.length} kelas tersedia</p>
    </div>

    <!-- 4 Kelas Summary Cards -->
    <div class="km-grid">${kelasCardsHtml}</div>

    <!-- Detail Panel -->
    <div class="km-detail-wrap">
      <div class="km-detail-header" style="border-left: 4px solid ${selectedKm.accent};">
        <div>
          <span class="km-detail-title">${selectedKm.icon} ${selectedKm.nama}</span>
          <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">${assignedNims.length} siswa · ${assignedStaffId ? '1 mentor' : 'Belum ada mentor'}</span>
        </div>
        <span class="badge" style="background:${selectedKm.accent}22; color:${selectedKm.accent}; border:1px solid ${selectedKm.accent}44;">
          ${selectedKm.icon} Aktif
        </span>
      </div>

      <div class="km-detail-grid">
        <!-- LEFT: Assign Mentor -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">👤 Assign Mentor Staf</div>
            ${assignedStaffId ? `<span class="badge badge-success">✓ Ada Mentor</span>` : `<span class="badge badge-ghost">Belum Ada</span>`}
          </div>
          <div class="card-body">
            ${mentorBanner}
            <div class="form-group">
              <label class="form-label" for="km-staff-sel">Pilih Staf sebagai Mentor <span class="req">*</span></label>
              <select class="form-control" id="km-staff-sel">
                ${staffOpts}
              </select>
            </div>
            <div class="form-hint" style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">
              ℹ️ Staf yang sudah menjadi mentor di kelas lain ditampilkan dengan keterangan kelasnya.
            </div>
            <button class="btn btn-gold btn-full" onclick="saveStaffKelasAssign('${selectedKelasId}')">
              💾 Simpan Mentor Kelas
            </button>
          </div>
        </div>

        <!-- RIGHT: Assign Siswa -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🎓 Assign Siswa ke Kelas</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="badge badge-info">${assignedNims.length} dipilih</span>
              <span class="badge badge-ghost">${activeSiswa.length} total</span>
            </div>
          </div>
          <div style="padding:10px 16px; border-bottom:1px solid var(--border-xs); display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="toggleKelasChk(true)">☑ Pilih Semua</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleKelasChk(false)">☐ Batal Semua</button>
            <button class="btn btn-primary btn-sm" onclick="openAddSiswaToKelas('${selectedKelasId}')" style="margin-left:auto;" title="Tambah siswa baru dan langsung assign ke kelas ini">
              ➕ Tambah Siswa ke Kelas Ini
            </button>
            <span style="font-size:11px; color:var(--text-muted);">⚠ = sudah di kelas lain</span>
          </div>
          <div class="mentor-assign-list" style="max-height:380px; overflow-y:auto;">
            ${siswaRows}
          </div>
          <div style="padding:12px 16px; border-top:1px solid var(--border-xs);">
            <button class="btn btn-primary btn-full" onclick="saveSiswaKelasAssign('${selectedKelasId}')">
              💾 Simpan Daftar Siswa
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

/** Pilih kelas yang aktif di panel admin */
function selectKelasCard(kelasId) {
  App.selectedKelas = kelasId;
  renderAdminView('kelas-mentoring');
}

/** Simpan assignment mentor (staf) ke kelas */
async function saveStaffKelasAssign(kelasId) {
  const newStaffId = document.getElementById('km-staff-sel')?.value || '';

  // Hapus mentor lama dari kelas ini (jika ada staf berbeda)
  const prevRecord = DB.cache.staffKelas.find(a => a.kelas_id === kelasId);
  if (prevRecord && prevRecord.staff_id !== newStaffId) {
    await DB.setStaffKelas(prevRecord.staff_id, null);
  }

  // Set mentor baru
  if (newStaffId) {
    await DB.setStaffKelas(newStaffId, kelasId);
  }

  const km    = KELAS_MENTORING.find(k => k.id === kelasId);
  const staff = newStaffId ? DB.getStaffById(newStaffId) : null;
  toast(
    staff
      ? `✅ ${staff.nama} berhasil ditugaskan sebagai mentor ${km.nama}!`
      : `✅ Mentor ${km.nama} berhasil dihapus.`,
    staff ? 'success' : 'info'
  );
  App.selectedKelas = kelasId;
  await renderAdminView('kelas-mentoring');
}

/** Simpan daftar siswa yang diassign ke kelas */
async function saveSiswaKelasAssign(kelasId) {
  const checked = [...document.querySelectorAll('.siswa-kelas-chk:checked')].map(el => el.value);
  await DB.setSiswaKelas(kelasId, checked);
  const km = KELAS_MENTORING.find(k => k.id === kelasId);
  toast(`✅ ${checked.length} siswa berhasil diassign ke ${km.nama}!`, 'success');
  App.selectedKelas = kelasId;
  await renderAdminView('kelas-mentoring');
}

/** Toggle semua checkbox siswa di panel kelas */
function toggleKelasChk(state) {
  document.querySelectorAll('.siswa-kelas-chk').forEach(cb => cb.checked = state);
}

// ============================================================
//  FEATURE: TAMBAH SISWA KE KELAS MENTORING (dari panel Kelas Mentoring)
// ============================================================

/**
 * Buka modal tambah siswa baru dengan pilihan Kelas Mentoring.
 * defaultKelasId: pre-select kelas yang sedang aktif di panel.
 */
function openAddSiswaToKelas(defaultKelasId) {
  // Reset edit state
  App.editSiswaNim = null;

  const kelasOpts = KELAS_OPTIONS.map(k =>
    `<option value="${k}">${k}</option>`
  ).join('');

  const progOpts = PROGRAM_OPTIONS.map(p =>
    `<option value="${p}">${p}</option>`
  ).join('');

  const kelasMenutoringOpts = KELAS_MENTORING.map(km =>
    `<option value="${km.id}" ${defaultKelasId === km.id ? 'selected' : ''}>${km.icon} ${km.nama}</option>`
  ).join('');

  openModal(`
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-hd">
        <div style="text-align:left;">
          <h3 class="modal-title">➕ Tambah Siswa ke Kelas Mentoring</h3>
          <span style="font-size:11px; color:var(--text-muted);">Siswa akan terdaftar dan langsung diassign ke kelas yang dipilih</span>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">

        <!-- Kelas Mentoring — paling atas agar jelas tujuannya -->
        <div class="form-group" style="background:rgba(255,255,255,0.04); border:1px solid var(--border-xs); border-radius:var(--r-md); padding:12px; margin-bottom:16px;">
          <label class="form-label" for="sktm-kelas-mentoring" style="color:var(--gold-light); font-size:11px; text-transform:uppercase; letter-spacing:.06em;">🏨 Kelas Mentoring <span class="req">*</span></label>
          <select class="form-control" id="sktm-kelas-mentoring">
            <option value="">— Tidak di-assign ke kelas mentoring —</option>
            ${kelasMenutoringOpts}
          </select>
          <span class="form-hint" style="font-size:10px;">Siswa akan langsung masuk ke kelas ini setelah disimpan.</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="sktm-nim">NIM <span class="req">*</span></label>
          <input type="text" class="form-control" id="sktm-nim"
            placeholder="Contoh: TIA2026001" autocomplete="off">
        </div>

        <div class="form-group">
          <label class="form-label" for="sktm-nama">Nama Lengkap <span class="req">*</span></label>
          <input type="text" class="form-control" id="sktm-nama"
            placeholder="Contoh: Budi Santoso" autocomplete="off">
        </div>

        <div class="form-group">
          <label class="form-label" for="sktm-kelas">Kelas Akademik <span class="req">*</span></label>
          <select class="form-control" id="sktm-kelas">
            <option value="">— Pilih Kelas —</option>
            ${kelasOpts}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="sktm-program">Program Studi <span class="req">*</span></label>
          <select class="form-control" id="sktm-program">
            <option value="">— Pilih Program —</option>
            ${progOpts}
          </select>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" id="btn-sktm-simpan" onclick="saveSiswaToKelas()">💾 Simpan &amp; Assign</button>
      </div>
    </div>`);
}

/**
 * Simpan siswa baru dari modal openAddSiswaToKelas,
 * lalu langsung assign ke kelas mentoring yang dipilih.
 */
async function saveSiswaToKelas() {
  const nim           = document.getElementById('sktm-nim')?.value?.trim();
  const nama          = document.getElementById('sktm-nama')?.value?.trim();
  const kelas         = document.getElementById('sktm-kelas')?.value;
  const program       = document.getElementById('sktm-program')?.value;
  const kelasMenutoringId = document.getElementById('sktm-kelas-mentoring')?.value;

  if (!nim)     { toast('NIM tidak boleh kosong', 'warning');    return; }
  if (!nama)    { toast('Nama tidak boleh kosong', 'warning');    return; }
  if (!kelas)   { toast('Pilih kelas akademik siswa', 'warning'); return; }
  if (!program) { toast('Pilih program studi', 'warning');        return; }

  // Disable tombol agar tidak double-submit
  const btn = document.getElementById('btn-sktm-simpan');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Menyimpan...'; }

  try {
    // 1. Tambah ke database siswa
    await DB.addSiswa({ nim, nama, kelas, program });

    // 2. Jika dipilih kelas mentoring, assign siswa ke kelas tersebut
    if (kelasMenutoringId) {
      const currentNims = DB.getSiswaByKelasId(kelasMenutoringId);
      if (!currentNims.includes(nim)) {
        await DB.setSiswaKelas(kelasMenutoringId, [...currentNims, nim]);
      }
    }

    const km = KELAS_MENTORING.find(k => k.id === kelasMenutoringId);
    const kelasLabel = km ? ` dan diassign ke ${km.icon} ${km.nama}` : '';
    toast(`✅ Siswa ${nama} berhasil ditambahkan${kelasLabel}!`, 'success');

    closeModal();

    // Kembali ke tab kelas-mentoring dan fokus ke kelas yang baru diisi
    if (kelasMenutoringId) App.selectedKelas = kelasMenutoringId;
    await renderAdminView('kelas-mentoring');

  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Simpan & Assign'; }
    toast(err.message || 'Gagal menyimpan data siswa', 'danger');
  }
}

// ============================================================
//  FEATURE: REKAP ABSEN MENTORING (Admin)
// ============================================================

function buildRekapAbsenView() {
  // Default tanggal ke hari ini jika belum pernah difilter
  if (!App.rekapFilter.tanggal) {
    App.rekapFilter.tanggal = DB.today();
  }
  const { tanggal, sesi } = App.rekapFilter;
  const activeStaff = DB.getActiveStaff();

  // Ambil semua absen sesuai filter
  const allAbsen = DB.getAbsenMentoring({ tanggal, sesi: sesi || undefined });

  // ── Summary bar 4 kelas ───────────────────────────────────
  const kelasStatHtml = KELAS_MENTORING.map(km => {
    const mentor      = activeStaff.find(s => DB.getStaffKelasId(s.id) === km.id);
    const siswaInKelas = DB.getSiswaByKelasId(km.id);
    const absenInKelas = allAbsen.filter(a => siswaInKelas.includes(a.siswa_nim));

    const hadir = absenInKelas.filter(a => a.status === 'Hadir').length;
    const total = absenInKelas.length;
    const pct   = total > 0 ? Math.round((hadir / total) * 100) : 0;

    // Tentukan warna ring progress
    const ringColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

    return `
      <div class="rekap-kelas-stat" style="--km-accent:${km.accent};">
        <div class="rks-left">
          <span class="rks-icon">${km.icon}</span>
          <div>
            <div class="rks-nama">${km.nama}</div>
            <div class="rks-mentor">${mentor ? mentor.nama : '<em>Belum ada mentor</em>'}</div>
          </div>
        </div>
        <div class="rks-right">
          <div class="rks-ring" style="--pct:${pct}; --ring-color:${ringColor};">
            <span class="rks-pct">${pct}%</span>
          </div>
          <div class="rks-detail">
            <span style="color:#10b981;">🟢 ${absenInKelas.filter(a=>a.status==='Hadir').length}</span>
            <span style="color:#f59e0b;">🟡 ${absenInKelas.filter(a=>a.status==='Sakit').length}</span>
            <span style="color:#60a5fa;">🔵 ${absenInKelas.filter(a=>a.status==='Izin').length}</span>
            <span style="color:#ef4444;">🔴 ${absenInKelas.filter(a=>a.status==='Alfa').length}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // ── Tabel per Kelas ───────────────────────────────────────
  const kelasTablesHtml = KELAS_MENTORING.map(km => {
    const mentor      = activeStaff.find(s => DB.getStaffKelasId(s.id) === km.id);
    const siswaInKelas = DB.getSiswaByKelasId(km.id)
      .map(nim => DB.getSiswaByNim(nim))
      .filter(Boolean)
      .filter(s => s.status === 'Aktif');

    if (siswaInKelas.length === 0) return '';

    const sesiList = sesi ? [sesi] : ['pagi', 'malam'];

    const rows = siswaInKelas.map(s => {
      const statusCells = sesiList.map(ss => {
        const rec = allAbsen.find(a => a.siswa_nim === s.nim && a.sesi === ss);
        if (!rec) {
          return `<td class="ra-td ra-status ra-none">—</td>`;
        }
        const colors = { Hadir: 'hadir', Sakit: 'sakit', Izin: 'izin', Alfa: 'alfa' };
        const icons  = { Hadir: '🟢', Sakit: '🟡', Izin: '🔵', Alfa: '🔴' };
        return `<td class="ra-td ra-status ra-${colors[rec.status] || 'none'}">
          ${icons[rec.status] || '—'} ${rec.status}
          ${rec.catatan ? `<div class="ra-catatan">${rec.catatan}</div>` : ''}
        </td>`;
      }).join('');

      return `<tr class="ra-row">
        <td class="ra-td ra-nama">
          <div class="ra-av">${DB.getInitials(s.nama)}</div>
          <div>
            <div class="ra-siswa-nama">${s.nama}</div>
            <div class="ra-siswa-meta">${s.nim}</div>
          </div>
        </td>
        <td class="ra-td ra-kls">${s.kelas}</td>
        <td class="ra-td ra-prg">${s.program}</td>
        ${statusCells}
      </tr>`;
    }).join('');

    const hadir = allAbsen.filter(a =>
      siswaInKelas.map(s => s.nim).includes(a.siswa_nim) && a.status === 'Hadir'
    ).length;
    const totalRec = allAbsen.filter(a =>
      siswaInKelas.map(s => s.nim).includes(a.siswa_nim)
    ).length;

    const sesiHeaders = sesiList.map(ss =>
      `<th class="ra-th">${ss === 'pagi' ? '🌅 Pagi' : '🌙 Malam'}</th>`
    ).join('');

    return `
      <div class="card rekap-kelas-card" style="border-top: 3px solid ${km.accent};">
        <div class="card-header" style="border-bottom:1px solid var(--border-xs);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">${km.icon}</span>
            <div>
              <div class="card-title">${km.nama}</div>
              <div style="font-size:11px; color:var(--text-muted);">
                Mentor: <strong style="color:var(--text-secondary);">${mentor ? mentor.nama : '—'}</strong>
                · ${siswaInKelas.length} siswa terdaftar
              </div>
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <span class="badge" style="background:${km.accent}18; color:${km.accent}; border:1px solid ${km.accent}44;">
              ${hadir} / ${totalRec} hadir
            </span>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="ra-table">
            <thead>
              <tr>
                <th class="ra-th" style="min-width:200px;">Nama Siswa</th>
                <th class="ra-th">Kelas</th>
                <th class="ra-th">Program</th>
                ${sesiHeaders}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${siswaInKelas.length === 0 ? `
          <div class="empty-state" style="padding:24px;">
            <div class="empty-big">👥</div>
            <p>Belum ada siswa di kelas ini.</p>
          </div>` : ''}
      </div>`;
  }).filter(Boolean).join('');

  const noDataMsg = !kelasTablesHtml ? `
    <div class="empty-state">
      <div class="empty-big">📭</div>
      <p>Belum ada kelas yang memiliki siswa terdaftar.</p>
    </div>` : '';

  return `
    <div class="page-hd">
      <h2 class="page-title">📅 Rekap Absen Mentoring</h2>
      <p class="page-sub">Monitor kehadiran siswa per mentor · Data berdasarkan filter tanggal</p>
    </div>

    <!-- Filter Bar -->
    <div class="card rekap-filter-bar">
      <div class="rekap-filter-inner">
        <div class="form-group" style="margin:0; flex:1; min-width:160px;">
          <label class="form-label" style="font-size:10px;">📅 Tanggal</label>
          <input type="date" class="form-control" id="rf-tanggal"
            value="${tanggal}"
            max="${DB.today()}"
            onchange="applyRekapFilter()">
        </div>
        <div class="form-group" style="margin:0; min-width:140px;">
          <label class="form-label" style="font-size:10px;">🕐 Sesi</label>
          <select class="form-control" id="rf-sesi" onchange="applyRekapFilter()">
            <option value=""  ${sesi === ''      ? 'selected' : ''}>Semua Sesi</option>
            <option value="pagi"  ${sesi === 'pagi'  ? 'selected' : ''}>🌅 Pagi</option>
            <option value="malam" ${sesi === 'malam' ? 'selected' : ''}>🌙 Malam</option>
          </select>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="resetRekapFilter()" style="align-self:flex-end;">
          ↺ Reset
        </button>
      </div>
      <div class="rekap-date-info">
        Menampilkan data untuk: <strong>${formatDateLong(tanggal)}</strong>
        ${sesi ? ` · Sesi <strong>${sesi === 'pagi' ? '🌅 Pagi' : '🌙 Malam'}</strong>` : ' · Semua Sesi'}
        · Total absen tercatat: <strong>${allAbsen.length}</strong>
      </div>
    </div>

    <!-- Export Buttons -->
    <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-end;">
      <button class="btn btn-success btn-sm" onclick="exportRekapToExcel()" title="Download Rekap Excel">📥 Export Excel</button>
    </div>

    <!-- 4 Kelas Summary Stats -->
    <div class="rekap-stats-grid">
      ${kelasStatHtml}
    </div>

    <!-- Detail Tables per Kelas -->
    <div class="rekap-tables-wrap">
      ${kelasTablesHtml || noDataMsg}
    </div>`;
}

/** Terapkan filter tanggal/sesi dan re-render */
function applyRekapFilter() {
  App.rekapFilter.tanggal = document.getElementById('rf-tanggal')?.value || DB.today();
  App.rekapFilter.sesi    = document.getElementById('rf-sesi')?.value || '';
  renderAdminView('rekap-absen');
}

/** Reset filter ke hari ini */
function resetRekapFilter() {
  App.rekapFilter.tanggal = DB.today();
  App.rekapFilter.sesi    = '';
  renderAdminView('rekap-absen');
}


function togglePinReveal(id) {
  const container = document.querySelector(`.staff-pin-container[data-id="${id}"]`);
  if (!container) return;
  const stars = container.querySelector('.pin-stars');
  const btn = container.querySelector('button');
  const pin = container.dataset.pin;
  
  if (stars.textContent === '••••') {
    stars.textContent = pin;
    btn.textContent = '👁️‍🗨️';
    btn.title = 'Sembunyikan PIN';
  } else {
    stars.textContent = '••••';
    btn.textContent = '👁️';
    btn.title = 'Tampilkan PIN';
  }
}

const JABATAN_OPTIONS = [
  'Koordinator Akademik',
  'Staf Akademik',
  'Staf Pengajar',
  'Admin Akademik',
  'Staf Piket',
  'Teknisi'
];

function staffModal({ title, nama = '', jabatan = '', pin = '', id = null }) {
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
        <div class="form-group">
          <label class="form-label" for="m-jabatan">Jabatan <span class="req">*</span></label>
          <select class="form-control" id="m-jabatan">
            <option value="">— Pilih Jabatan —</option>
            ${opts}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="m-pin">PIN Akses (4 Digit) <span class="req">*</span></label>
          <input type="text" class="form-control" id="m-pin" value="${pin || '1234'}"
            maxlength="4" placeholder="1234" inputmode="numeric">
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
  staffModal({ title: '✏️ Edit Data Staf', nama: s.nama, jabatan: s.jabatan, pin: s.pin, id });
}

async function saveStaff() {
  const nama    = qs('#m-nama')?.value?.trim();
  const jabatan = qs('#m-jabatan')?.value;
  const pin     = qs('#m-pin')?.value?.trim();
  if (!nama)    { toast('Nama tidak boleh kosong', 'warning'); return; }
  if (!jabatan) { toast('Pilih jabatan', 'warning');           return; }
  if (!pin)     { toast('PIN tidak boleh kosong', 'warning');   return; }
  if (pin.length !== 4 || isNaN(pin)) { toast('PIN harus berupa 4 digit angka', 'warning'); return; }

  if (App.editStaffId) {
    await DB.updateStaff(App.editStaffId, { nama, jabatan, pin });
    toast(`✅ Data ${nama} diperbarui!`, 'success');
  } else {
    await DB.addStaff({ nama, jabatan, pin });
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
  const staff = DB.getAllStaff();
  
  // Set default dates if empty
  if (!App.logFilter.startDate) App.logFilter.startDate = DB.today();
  if (!App.logFilter.endDate) App.logFilter.endDate = DB.today();

  const filter = App.logFilter;
  const logs = DB.getLogs({
    startDate: filter.startDate,
    endDate: filter.endDate,
    staffId: filter.staffId,
    kategori: filter.kategori
  });

  const rows = logs.map(log => {
    const s   = staff.find(st => st.id === log.staff_id);
    const cat = DB.getCategory(log.kategori);
    
    let desc = log.deskripsi;
    if (desc && desc.startsWith('{') && desc.endsWith('}')) {
      try {
        const data = JSON.parse(desc);
        if (data && data.no_dosen) {
          const alasan = data.alasan_no_dosen || '—';
          const subjek = data.subject_no_dosen || '';
          desc = `⚠️ <strong style="color:var(--warning);">Tanpa Dosen</strong>${subjek ? ' · ' + subjek : ''} · Alasan: <em>${alasan}</em> · <span style="color:var(--text-secondary);">${data.aktivitas_staff || '—'}</span>`;
        } else if (data && data.metadata) {
          const meta = data.metadata;
          const chk = data.checklist || {};
          const okCount = Object.values(chk).filter(v => v.val).length;
          const total = Object.keys(chk).length || 20;
          const rName = ROOMS.find(r => r.id === meta.class_room)?.name || meta.class_room;
          const isClosed = data.is_closed || false;
          let statusText = isClosed ? '🔒 Selesai' : '⏳ Berjalan';
          if (isClosed && data.closed_by_nama) {
            statusText += ` (oleh ${data.closed_by_nama})`;
          }
          desc = `📝 <strong>${meta.subject || 'Mata Kuliah'}</strong> (${meta.pic_dosen || 'Dosen'}) · Room: ${rName} · ${meta.total_act || 0}/${meta.total_std || 0} Pax · ${okCount}/${total} OK · <strong style="color:${isClosed ? 'var(--info)' : 'var(--warning)'};">${statusText}</strong>`;
        }
      } catch(e) {}
    }
    
    return `
      <tr>
        <td class="text-xs text-muted">${log.tanggal}</td>
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

  const staffOpts = staff.map(s => `<option value="${s.id}" ${filter.staffId === s.id ? 'selected' : ''}>${s.nama}</option>`).join('');
  const catOpts = ACTIVITY_CATS.map(c => `<option value="${c.id}" ${filter.kategori === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">📋 Log Aktivitas Staf</h2>
      <p class="page-sub">Menampilkan ${logs.length} entri berdasarkan filter</p>
    </div>

    <!-- Filter Form -->
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-body" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
        <div class="form-group" style="margin:0; flex:1; min-width:140px;">
          <label class="form-label" style="font-size:11px;">Tanggal Mulai</label>
          <input type="date" class="form-control" id="f-start-date" value="${filter.startDate}">
        </div>
        <div class="form-group" style="margin:0; flex:1; min-width:140px;">
          <label class="form-label" style="font-size:11px;">Tanggal Akhir</label>
          <input type="date" class="form-control" id="f-end-date" value="${filter.endDate}">
        </div>
        <div class="form-group" style="margin:0; flex:1; min-width:150px;">
          <label class="form-label" style="font-size:11px;">Staf</label>
          <select class="form-control" id="f-staff">
            <option value="">Semua Staf</option>
            ${staffOpts}
          </select>
        </div>
        <div class="form-group" style="margin:0; flex:1; min-width:180px;">
          <label class="form-label" style="font-size:11px;">Kategori</label>
          <select class="form-control" id="f-cat">
            <option value="">Semua Kategori</option>
            ${catOpts}
          </select>
        </div>
        <button class="btn btn-primary" onclick="applyLogFilter()" style="white-space:nowrap;">🔍 Filter Data</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 Rekap Data Log</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <span class="badge badge-gold">${logs.length} entri</span>
          <button class="btn btn-success btn-sm" onclick="exportLogsToExcel(App.logFilter)" title="Download Excel">📥 Excel</button>
          <button class="btn btn-info btn-sm" onclick="exportLogsToPDF(App.logFilter)" title="Download PDF">📄 PDF</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAllLogsUI()">🗑️ Hapus Semua Log</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nama Staf</th>
              <th>Jam</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0
              ? rows
              : '<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-muted)">Belum ada log aktivitas yang sesuai</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function applyLogFilter() {
  App.logFilter.startDate = document.getElementById('f-start-date')?.value || DB.today();
  App.logFilter.endDate   = document.getElementById('f-end-date')?.value || DB.today();
  App.logFilter.staffId   = document.getElementById('f-staff')?.value || '';
  App.logFilter.kategori  = document.getElementById('f-cat')?.value || '';
  renderAdminView('logs');
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

function openClassChecklistModal(catId, jamParam = null, staffIdParam = null) {
  const jam = jamParam || qs('#log-jam')?.value;
  const staffId = staffIdParam || App.user.id;
  
  const savedLogs = jam 
    ? DB.getLogs({ staffId: staffId, tanggal: DB.today() }).filter(l => l.jam === jam)
    : [];
  const savedLog = savedLogs.find(l => l.kategori === catId);
  const isSaved = !!savedLog;
  
  const rawData = isSaved ? savedLog.deskripsi : (App.draftLogs[catId] || '');
  let data = {
    is_closed: false, no_dosen: false,
    metadata: { pic_dosen: '', subject: '', class_room: '', chairman: '', program: '',
      total_std: '', unwell: 0, no_show: 0, on_leave: 0, total_act: 0,
      std: '', atd: '', sta: '', ata: '' },
    checklist: {}
  };
  try { if (rawData) data = JSON.parse(rawData); } catch(e) {}

  const isNoDosen = data.no_dosen === true;
  const isClosed = isSaved ? (data.is_closed || data.no_dosen || false) : false;
  const dis = (isClosed && App.role !== 'admin') ? 'disabled' : '';
  const disND = dis; // same disabled state for no-dosen form

  const meta = data.metadata || {};
  const chk = data.checklist || {};

  const roomOpts = ROOMS.map(r => 
    `<option value="${r.id}" ${meta.class_room === r.id ? 'selected' : ''}>${r.name}</option>`
  ).join('');

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

  const alasanOptions = ['Sakit', 'Izin', 'Tugas Luar Kota', 'Kegiatan Institusi', 'Tidak Diketahui', 'Lainnya'];
  const alasanOpts = alasanOptions.map(a => 
    `<option value="${a}" ${data.alasan_no_dosen === a ? 'selected' : ''}>${a}</option>`
  ).join('');

  const toggleChecked = isNoDosen ? 'checked' : '';
  const ndDisplay = isNoDosen ? 'block' : 'none';
  const normalDisplay = isNoDosen ? 'none' : 'block';
  const toggleCanChange = !dis ? '' : 'disabled';

  const modalHtml = `
    <div class="modal-box" style="max-width:850px; width:95%;">
      <div class="modal-hd">
        <div style="text-align:left;">
          <h3 class="modal-title">📋 Class Checklist Form</h3>
          <span style="font-size:11px; color:var(--text-muted); font-weight:500;">
            Triesakti Institute of Airlines &amp; Kesiapan Kelas
          </span>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="max-height:65vh; overflow-y:auto; padding-right:10px;">

        <!-- Toggle: Dosen Tidak Hadir -->
        <div class="nd-toggle-banner ${isNoDosen ? 'nd-active' : ''}">
          <label class="nd-toggle-label" style="${dis ? 'cursor:not-allowed;' : ''}">
            <div class="nd-switch-wrap">
              <input type="checkbox" id="toggle-no-dosen" ${toggleChecked} ${toggleCanChange} onchange="toggleNoDosen()" style="display:none;">
              <div class="nd-switch-track">
                <div class="nd-switch-thumb"></div>
              </div>
            </div>
            <div class="nd-toggle-text">
              <div id="nd-toggle-title" style="font-weight:700; font-size:14px; color:${isNoDosen ? 'var(--warning)' : 'var(--text-primary)'};">
                ${isNoDosen ? '⚠️ Dosen Tidak Hadir' : '✅ Dosen Hadir (Normal)'}
              </div>
              <div id="nd-toggle-desc" style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${isNoDosen ? 'Mode aktivitas manual staf — tanpa checklist kelas.' : 'Aktifkan jika dosen tidak hadir / berhalangan pada jam ini.'}
              </div>
            </div>
          </label>
        </div>

        <!-- SECTION: Form Aktivitas Manual (No Dosen) -->
        <div id="section-no-dosen" style="display:${ndDisplay};">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-top:16px; text-align:left;">
            <div>
              <div class="form-group">
                <label class="form-label" style="font-size:10px;">Mata Kuliah yang Seharusnya Berlangsung <span class="req">*</span></label>
                <input type="text" class="form-control" id="nd-subject" value="${data.subject_no_dosen || ''}" ${disND} placeholder="Contoh: Navigasi Udara, Prosedur Keamanan...">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:10px;">Nama Dosen yang Tidak Hadir <span style="color:var(--text-muted);">(opsional)</span></label>
                <input type="text" class="form-control" id="nd-nama-dosen" value="${data.nama_dosen_absen || ''}" ${disND} placeholder="Nama dosen (jika diketahui)">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:10px;">Alasan Ketidakhadiran <span class="req">*</span></label>
                <select class="form-control" id="nd-alasan" ${disND}>
                  <option value="">— Pilih Alasan —</option>
                  ${alasanOpts}
                </select>
              </div>
            </div>
            <div>
              <div class="form-group">
                <label class="form-label" style="font-size:10px;">Aktivitas Staf Selama Jam Ini <span class="req">*</span></label>
                <textarea class="form-control" id="nd-aktivitas" rows="5" ${disND} placeholder="Contoh: Mendampingi siswa belajar mandiri, menjaga ketertiban kelas, menginformasikan jadwal pengganti ke ketua kelas, mengisi absensi siswa...">${data.aktivitas_staff || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:10px;">Catatan Tambahan <span style="color:var(--text-muted);">(opsional)</span></label>
                <textarea class="form-control" id="nd-catatan" rows="2" ${disND} placeholder="Catatan kondisi kelas, tindak lanjut, atau informasi lainnya...">${data.catatan || ''}</textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION: Normal Checklist Form -->
        <div id="section-normal-checklist" style="display:${normalDisplay};">
          <h4 style="color:var(--gold-light); font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; margin-bottom:14px; margin-top:16px; text-align:left;">
            Class Preparation Metadata
          </h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:24px; text-align:left;">
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
          <h4 style="color:var(--gold-light); font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; margin-bottom:14px; text-align:left;">
            Classroom &amp; Students Checklist
          </h4>
          <div style="display:flex; flex-direction:column; background:rgba(0,0,0,0.2); border:1px solid var(--border-sm); border-radius:var(--r-md); padding:0 14px;">
            ${rowsHtml}
          </div>
        </div>

      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; width:100%;">
        <div>
          ${isSaved && !isClosed && !isNoDosen ? `
            <button class="btn btn-danger" onclick="closeClass('${catId}', '${savedLog?.id}')">🔒 Close Class</button>
          ` : ''}
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
          ${isSaved 
            ? (!isClosed || App.role === 'admin' ? `<button class="btn btn-primary" onclick="updateClassChecklist('${catId}', '${savedLog?.id}', false, ${isClosed})">💾 Update Data</button>` : '') 
            : `<button class="btn btn-gold" onclick="saveClassChecklistDraft('${catId}')">💾 ${isNoDosen ? 'Simpan Laporan' : 'Simpan Draf Checklist'}</button>`
          }
        </div>
      </div>
    </div>`;

  openModal(modalHtml);
  if (!isNoDosen) calcActualPax();
}

function toggleNoDosen() {
  const toggle = document.getElementById('toggle-no-dosen');
  const isChecked = toggle?.checked;
  
  const sectionNormal = document.getElementById('section-normal-checklist');
  const sectionND     = document.getElementById('section-no-dosen');
  const banner        = document.querySelector('.nd-toggle-banner');
  const titleEl       = document.getElementById('nd-toggle-title');
  const descEl        = document.getElementById('nd-toggle-desc');
  
  if (sectionNormal) sectionNormal.style.display = isChecked ? 'none' : 'block';
  if (sectionND)     sectionND.style.display     = isChecked ? 'block' : 'none';
  if (banner)        banner.classList.toggle('nd-active', isChecked);
  if (titleEl) {
    titleEl.innerHTML = isChecked ? '⚠️ Dosen Tidak Hadir' : '✅ Dosen Hadir (Normal)';
    titleEl.style.color = isChecked ? 'var(--warning)' : 'var(--text-primary)';
  }
  if (descEl) {
    descEl.textContent = isChecked
      ? 'Mode aktivitas manual staf — tanpa checklist kelas.'
      : 'Aktifkan jika dosen tidak hadir / berhalangan pada jam ini.';
  }

  // Update footer save button label
  const saveBtn = document.querySelector('.modal-footer .btn-gold');
  if (saveBtn) saveBtn.textContent = isChecked ? '💾 Simpan Laporan' : '💾 Simpan Draf Checklist';
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

  // === Handle no-dosen mode ===
  const noDosen = document.getElementById('toggle-no-dosen')?.checked || false;
  if (noDosen) {
    const ndSubject  = qs('#nd-subject')?.value?.trim();
    const ndAlasan   = qs('#nd-alasan')?.value;
    const ndAktivitas = qs('#nd-aktivitas')?.value?.trim();
    const ndCatatan  = qs('#nd-catatan')?.value?.trim();
    const ndNamaDosen = qs('#nd-nama-dosen')?.value?.trim();

    if (!ndSubject)  { toast('Mata kuliah harus diisi', 'warning'); return; }
    if (!ndAlasan)   { toast('Pilih alasan ketidakhadiran dosen', 'warning'); return; }
    if (!ndAktivitas){ toast('Aktivitas staf harus diisi', 'warning'); return; }

    const draftData = {
      no_dosen: true,
      subject_no_dosen: ndSubject,
      nama_dosen_absen: ndNamaDosen || '',
      alasan_no_dosen: ndAlasan,
      aktivitas_staff: ndAktivitas,
      catatan: ndCatatan || '',
      recorded_at: new Date().toISOString(),
      recorded_by_id: App.user?.id,
      recorded_by_nama: App.user?.nama
    };

    App.draftLogs[catId] = JSON.stringify(draftData);
    toast('✅ Laporan aktivitas (tanpa dosen) berhasil disimpan!', 'success');
    closeModal();
    updateDynamicForm(catId);
    refreshCatChips();
    return;
  }
  // === End no-dosen handling ===

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
    is_closed: false,
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

async function updateClassChecklist(catId, logId, isCloseAction = false, currentIsClosed = false) {
  const pic = qs('#c-pic')?.value?.trim();
  const subject = qs('#c-subject')?.value?.trim();
  const room = qs('#c-room')?.value;
  const totalStdVal = qs('#c-total-std')?.value;

  // === Handle no-dosen mode ===
  const noDosen = document.getElementById('toggle-no-dosen')?.checked || false;
  if (noDosen) {
    const ndSubject   = qs('#nd-subject')?.value?.trim();
    const ndAlasan    = qs('#nd-alasan')?.value;
    const ndAktivitas = qs('#nd-aktivitas')?.value?.trim();
    const ndCatatan   = qs('#nd-catatan')?.value?.trim();
    const ndNamaDosen = qs('#nd-nama-dosen')?.value?.trim();

    if (!ndSubject)   { toast('Mata kuliah harus diisi', 'warning'); return; }
    if (!ndAlasan)    { toast('Pilih alasan ketidakhadiran dosen', 'warning'); return; }
    if (!ndAktivitas) { toast('Aktivitas staf harus diisi', 'warning'); return; }

    const updatedData = {
      no_dosen: true,
      subject_no_dosen: ndSubject,
      nama_dosen_absen: ndNamaDosen || '',
      alasan_no_dosen: ndAlasan,
      aktivitas_staff: ndAktivitas,
      catatan: ndCatatan || '',
      updated_at: new Date().toISOString(),
      recorded_by_id: App.user?.id,
      recorded_by_nama: App.user?.nama
    };

    await DB.updateLog(logId, { deskripsi: JSON.stringify(updatedData) });
    toast('✅ Laporan aktivitas berhasil diperbarui!', 'success');
    closeModal();
    if (App.role === 'admin') await renderAdminView(App.tab);
    else await renderStaffView(App.tab);
    return;
  }
  // === End no-dosen handling ===

  if (!pic) { toast('Dosen (P.I.C) harus diisi', 'warning'); return; }
  if (!subject) { toast('Subject / Mata Kuliah harus diisi', 'warning'); return; }
  if (!room) { toast('Pilih Ruang Kelas', 'warning'); return; }
  if (totalStdVal === '') { toast('Total Siswa harus diisi', 'warning'); return; }

  const totalStd = parseInt(totalStdVal) || 0;
  const unwell = parseInt(qs('#c-unwell')?.value) || 0;
  const noShow = parseInt(qs('#c-no-show')?.value) || 0;
  const onLeave = parseInt(qs('#c-on-leave')?.value) || 0;
  const totalAct = Math.max(0, totalStd - unwell - noShow - onLeave);

  // Retrieve existing log to preserve properties like closed_by_id
  const existingLogs = DB.cache.logs;
  const logObj = existingLogs.find(l => l.id === logId);
  let oldData = {};
  if (logObj && logObj.deskripsi) {
    try { oldData = JSON.parse(logObj.deskripsi); } catch(e) {}
  }

  const updatedData = {
    ...oldData, // Preserve previous data like closed_by_nama if it exists
    is_closed: isCloseAction || currentIsClosed,
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
    checklist: {},
    updated_by_id: App.user.id,
    updated_by_nama: App.user.nama
  };

  if (isCloseAction) {
    updatedData.closed_by_id = App.user.id;
    updatedData.closed_by_nama = App.user.nama;
  }

  // Read checklist items
  qsa('.modal-chk-val').forEach(el => {
    const no = el.dataset.no;
    const isChecked = el.checked;
    const remarkEl = qs(`.modal-chk-remark[data-no="${no}"]`);
    const remark = remarkEl ? remarkEl.value?.trim() : '';
    
    updatedData.checklist[no] = {
      val: isChecked,
      remark: remark
    };
  });

  // Update in DB log
  const descString = JSON.stringify(updatedData);
  await DB.updateLog(logId, { deskripsi: descString });

  if (isCloseAction) {
    toast('🔒 Kelas berhasil ditutup & diselesaikan!', 'success');
  } else {
    toast('✅ Data kelas berhasil diperbarui!', 'success');
  }
  
  closeModal();
  
  // Refresh view
  if (App.role === 'admin') {
    await renderAdminView(App.tab);
  } else {
    await renderStaffView(App.tab);
  }
}

async function closeClass(catId, logId) {
  if (!confirm('Apakah Anda yakin ingin menutup kelas ini? Setelah ditutup, data checklist tidak dapat diedit kembali.')) return;
  await updateClassChecklist(catId, logId, true);
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

// ============================================================
//  DELETE LOGS UI (Admin)
// ============================================================
async function deleteAllLogsUI() {
  if (!confirm('⚠️ HAPUS SEMUA LOG AKTIVITAS\n\nAnda yakin ingin menghapus SELURUH log aktivitas dari semua staf?\n\nData yang sudah terhapus tidak dapat dipulihkan. Lanjutkan?')) return;
  await DB.deleteAllLogs();
  toast('🗑️ Seluruh log aktivitas berhasil dihapus.', 'warning');
  await renderAdminView('logs');
}

async function deleteStaffLogsUI(id, nama) {
  if (!confirm(`⚠️ HAPUS LOG STAF\n\nAnda yakin ingin menghapus SELURUH log aktivitas dari staf:\n"${nama}"?\n\nData yang sudah terhapus tidak dapat dipulihkan. Lanjutkan?`)) return;
  await DB.deleteStaffLogs(id);
  toast(`🗑️ Log aktivitas staf "${nama}" berhasil dihapus.`, 'warning');
  await renderAdminView('staff');
}

// ============================================================
//  FEATURE: ABSEN MENTORING (Staff)
// ============================================================

/**
 * Cek apakah jendela waktu absen untuk sesi tertentu sedang terbuka.
 * Pagi : 05:00 – 06:59
 * Malam: 20:00 – 21:59
 */
function isAbsenWindowOpen(sesi, kelasId) {
  const cfg   = DB.getAbsenConfig(kelasId, sesi);
  if (!cfg) return false;
  const now   = DB.nowHHMM();
  return now >= cfg.windowStart && now <= cfg.windowEnd;
}

function buildMentoringAbsen(sesi) {
  const today        = DB.today();
  const kelasId      = DB.getStaffKelasId(App.user.id);
  const cfg          = DB.getAbsenConfig(kelasId, sesi);
  const label        = cfg.label;
  const jam          = cfg.jam;

  // Gunakan getMentorStudents (via kelas) untuk dapat daftar siswa
  const assignedNims = DB.getMentorStudents(App.user.id);
  const kelasInfo    = KELAS_MENTORING.find(k => k.id === kelasId);

  const siswaList    = assignedNims
    .map(nim => DB.getSiswaByNim(nim))
    .filter(Boolean)
    .filter(s => s.status === 'Aktif');

  const isOpen      = isAbsenWindowOpen(sesi, kelasId);
  const savedAbsen  = DB.getAbsenMentoring({ staffId: App.user.id, tanggal: today, sesi });
  const isSubmitted = savedAbsen.length === siswaList.length && siswaList.length > 0;

  // Statistik jika sudah ada absen tersimpan
  const statHadir = savedAbsen.filter(a => a.status === 'Hadir').length;
  const statSakit = savedAbsen.filter(a => a.status === 'Sakit').length;
  const statIzin  = savedAbsen.filter(a => a.status === 'Izin').length;
  const statAlfa  = savedAbsen.filter(a => a.status === 'Alfa').length;

  /* -- Banner kelas info -- */
  const kelasBannerHtml = kelasInfo ? `
    <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 14px;
                background:${kelasInfo.accent}18; border:1px solid ${kelasInfo.accent}44;
                border-radius:var(--r-sm); margin-bottom:var(--sp-4); font-size:13px;">
      <span style="font-size:18px;">${kelasInfo.icon}</span>
      <span style="color:${kelasInfo.accent}; font-weight:700;">${kelasInfo.nama}</span>
      <span style="color:var(--text-muted);">· ${siswaList.length} siswa terdaftar</span>
    </div>` : '';

  /* -- Banner waktu -- */
  let timeBanner = '';
  if (!isOpen) {
    const now = DB.nowHHMM();
    const isBeforeWindow = now < cfg.windowStart;
    timeBanner = `
      <div class="absen-time-banner ${isBeforeWindow ? 'banner-waiting' : 'banner-closed'}">
        <div class="atb-icon">${sesi === 'pagi' ? '🌅' : sesi === 'malam' ? '🌙' : '🟡'}</div>
        <div>
          <div class="atb-title">${isBeforeWindow ? 'Absen belum dibuka' : 'Waktu absen telah berakhir'}</div>
          <div class="atb-sub">
            Absen ${label} hanya bisa diisi pada <strong>${cfg.windowStart} – ${cfg.windowEnd} WITA</strong>.
            ${isBeforeWindow ? `Sekarang: ${now} WITA — silakan kembali saat jamnya tiba.` : `Sekarang: ${now} WITA.`}
          </div>
        </div>
      </div>`;
  }

  /* -- Summary jika sudah submit -- */
  let summaryHtml = '';
  if (savedAbsen.length > 0) {
    summaryHtml = `
      <div class="absen-summary-bar">
        <div class="asb-item asb-hadir">🟢 Hadir <strong>${statHadir}</strong></div>
        <div class="asb-item asb-sakit">🟡 Sakit <strong>${statSakit}</strong></div>
        <div class="asb-item asb-izin">🔵 Izin  <strong>${statIzin}</strong></div>
        <div class="asb-item asb-alfa">🔴 Alfa  <strong>${statAlfa}</strong></div>
        <div class="asb-item" style="color:var(--text-muted); font-size:11px; align-self:center;">
          ${isSubmitted ? '📋 Semua terisi' : `${savedAbsen.length}/${siswaList.length} terisi`}
        </div>
      </div>`;
  }

  /* -- Rows siswa -- */
  const rowsHtml = siswaList.length === 0
    ? `<div class="empty-state" style="padding:48px;">
         <div class="empty-big">👥</div>
         <p>Belum ada siswa yang terdaftar di ${kelasInfo ? kelasInfo.nama : 'kelas Anda'}.</p>
         <p style="font-size:12px; color:var(--text-muted);">Hubungi Manager Akademik untuk menambahkan siswa ke kelas Anda.</p>
       </div>`
    : siswaList.map(s => {
        const savedRec   = savedAbsen.find(a => a.siswa_nim === s.nim);
        const curStatus  = savedRec?.status || '';
        const curCatatan = savedRec?.catatan || '';
        const locked     = !isOpen;

        const statusBtns = ['Hadir','Sakit','Izin','Alfa'].map(st => `
          <button class="absen-status-btn absen-${st.toLowerCase()} ${curStatus === st ? 'selected' : ''}"
            id="absen-btn-${s.nim}-${st}"
            onclick="selectAbsenStatus('${s.nim}', '${st}')"
            ${locked ? 'disabled' : ''}>
            ${ st === 'Hadir' ? '🟢' : st === 'Sakit' ? '🟡' : st === 'Izin' ? '🔵' : '🔴' } ${st}
          </button>`).join('');

        return `
          <div class="absen-row" id="absen-row-${s.nim}" data-nim="${s.nim}" data-nama="${s.nama}">
            <div class="absen-row-left">
              <div class="av av-sm" style="background:linear-gradient(135deg,var(--gold),var(--gold-dark)); flex-shrink:0;">${DB.getInitials(s.nama)}</div>
              <div>
                <div class="absen-siswa-nama">${s.nama}</div>
                <div class="absen-siswa-meta">${s.nim} · ${s.kelas} · ${s.program}</div>
              </div>
            </div>
            <div class="absen-row-right">
              <div class="absen-btn-group">${statusBtns}</div>
              <input type="text" class="form-control absen-catatan" id="catatan-${s.nim}"
                value="${curCatatan}" placeholder="Catatan (opsional)"
                style="font-size:12px; margin-top:8px;"
                ${locked ? 'disabled' : ''}>
            </div>
          </div>`;
      }).join('');

  const saveBtn = (isOpen && siswaList.length > 0) ? `
    <div style="margin-top:20px;">
      <button class="btn btn-gold btn-full" onclick="saveAbsenBatch('${sesi}')" id="btn-save-absen">
        💾 Simpan Daftar Hadir ${label}
      </button>
    </div>` : '';

  return `
    <div class="page-hd">
      <h2 class="page-title">${sesi === 'pagi' ? '🌅' : '🌙'} Daftar Hadir Mentoring ${label}</h2>
      <p class="page-sub">Sesi ${jam} · ${formatDateLong(today)}${kelasInfo ? ` · ${kelasInfo.icon} ${kelasInfo.nama}` : ''}</p>
    </div>

    ${kelasBannerHtml}
    ${timeBanner}
    ${summaryHtml}

    <div class="card">
      <div class="card-header">
        <div class="card-title">📝 Isi Kehadiran Siswa</div>
        <span class="badge ${isOpen ? 'badge-success' : 'badge-ghost'}">
          ${isOpen ? '● Waktu Absen Terbuka' : '— Di Luar Jadwal'}
        </span>
      </div>
      <div class="absen-list">
        ${rowsHtml}
      </div>
      ${saveBtn}
    </div>`;
}

/** Update tampilan button status saat diklik */
function selectAbsenStatus(nim, status) {
  const row = document.getElementById(`absen-row-${nim}`);
  if (!row) return;
  row.querySelectorAll('.absen-status-btn').forEach(btn => btn.classList.remove('selected'));
  const target = document.getElementById(`absen-btn-${nim}-${status}`);
  if (target) target.classList.add('selected');
}

/** Simpan semua absen siswa secara batch */
async function saveAbsenBatch(sesi) {
  const kelasId = DB.getStaffKelasId(App.user.id);
  if (!isAbsenWindowOpen(sesi, kelasId)) {
    toast('Waktu absen sudah ditutup. Tidak dapat menyimpan.', 'danger');
    return;
  }

  const cfg          = DB.getAbsenConfig(kelasId, sesi);
  const today        = DB.today();
  const assignedNims = DB.getMentorStudents(App.user.id);
  const siswaList    = assignedNims
    .map(nim => DB.getSiswaByNim(nim))
    .filter(Boolean)
    .filter(s => s.status === 'Aktif');

  if (siswaList.length === 0) {
    toast('Tidak ada siswa yang diassign.', 'warning');
    return;
  }

  let saved = 0;
  let missing = [];

  for (const s of siswaList) {
    const selectedBtn = document.querySelector(`#absen-row-${s.nim} .absen-status-btn.selected`);
    const status  = selectedBtn?.textContent?.trim().split(' ').pop() || '';
    const catatan = document.getElementById(`catatan-${s.nim}`)?.value?.trim() || '';

    if (!status) {
      missing.push(s.nama);
      continue;
    }

    await DB.saveAbsenMentoring({
      staff_id:   App.user.id,
      staff_nama: App.user.nama,
      siswa_nim:  s.nim,
      siswa_nama: s.nama,
      tanggal:    today,
      sesi,
      status,
      catatan
    });
    saved++;
  }

  if (missing.length > 0) {
    toast(`⚠️ ${missing.length} siswa belum dipilih statusnya: ${missing.join(', ')}`, 'warning');
  }
  if (saved > 0) {
    toast(`✅ ${saved} absen berhasil disimpan untuk sesi ${cfg.label}!`, 'success');
  }

  await renderStaffView(`absen-${sesi}`);
}

// ============================================================
//  FEATURE: WAKTU ABSEN MENTORING (Admin)
// ============================================================

function buildWaktuAbsenView() {
  const rows = KELAS_MENTORING.map(km => {
    const cfgPagi = DB.getAbsenConfig(km.id, 'pagi');
    const cfgMalam = DB.getAbsenConfig(km.id, 'malam');
    const cfgSabtu = DB.getAbsenConfig(km.id, 'sabtu');
    
    return `
      <tr>
        <td>
          <div class="name-cell">
            <div class="av av-sm" style="background:${km.accent}22; color:${km.accent}; flex-shrink:0">${km.icon}</div>
            <span class="td-strong">${km.nama}</span>
          </div>
        </td>
        <td>
          <span class="badge badge-info" style="font-size:11px;">${cfgPagi.jam}</span><br>
          <span style="font-size:11px; color:var(--text-muted)">${cfgPagi.windowStart} - ${cfgPagi.windowEnd}</span>
        </td>
        <td>
          <span class="badge badge-info" style="font-size:11px;">${cfgMalam.jam}</span><br>
          <span style="font-size:11px; color:var(--text-muted)">${cfgMalam.windowStart} - ${cfgMalam.windowEnd}</span>
        </td>
        <td>
          <span class="badge badge-info" style="font-size:11px;">${cfgSabtu.jam}</span><br>
          <span style="font-size:11px; color:var(--text-muted)">${cfgSabtu.windowStart} - ${cfgSabtu.windowEnd}</span>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openEditWaktuAbsen('${km.id}')">✏️ Edit Jam</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">⏰ Pengaturan Waktu Absen</h2>
      <p class="page-sub">Atur jendela waktu absensi Pagi, Malam, dan Sabtu per kelas mentoring</p>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Kelas Mentoring</th>
              <th>Sesi Pagi</th>
              <th>Sesi Malam</th>
              <th>Sesi Sabtu</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function openEditWaktuAbsen(kelasId) {
  const km = KELAS_MENTORING.find(k => k.id === kelasId);
  if (!km) return;
  const cfgPagi = DB.getAbsenConfig(kelasId, 'pagi');
  const cfgMalam = DB.getAbsenConfig(kelasId, 'malam');
  const cfgSabtu = DB.getAbsenConfig(kelasId, 'sabtu');
  
  const modalHtml = `
    <div class="modal-box" style="max-width: 500px;">
      <div class="modal-hd">
        <h3 class="modal-title">⏰ Edit Waktu Absen ${km.nama}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="text-align:left; max-height: 70vh; overflow-y: auto;">
        <h4 style="margin-bottom:8px; color:var(--gold-light); font-size:13px;">Sesi Pagi</h4>
        <div style="display:flex; gap:12px; margin-bottom:16px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Buka</label>
            <input type="time" class="form-control" id="m-pagi-start" value="${cfgPagi.windowStart}">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Tutup</label>
            <input type="time" class="form-control" id="m-pagi-end" value="${cfgPagi.windowEnd}">
          </div>
        </div>
        
        <h4 style="margin-bottom:8px; color:var(--gold-light); font-size:13px;">Sesi Malam</h4>
        <div style="display:flex; gap:12px; margin-bottom:16px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Buka</label>
            <input type="time" class="form-control" id="m-malam-start" value="${cfgMalam.windowStart}">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Tutup</label>
            <input type="time" class="form-control" id="m-malam-end" value="${cfgMalam.windowEnd}">
          </div>
        </div>

        <h4 style="margin-bottom:8px; color:var(--gold-light); font-size:13px;">Sesi Sabtu</h4>
        <div style="display:flex; gap:12px; margin-bottom:0;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Buka</label>
            <input type="time" class="form-control" id="m-sabtu-start" value="${cfgSabtu.windowStart}">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Tutup</label>
            <input type="time" class="form-control" id="m-sabtu-end" value="${cfgSabtu.windowEnd}">
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveWaktuAbsen('${kelasId}')">💾 Simpan</button>
      </div>
    </div>`;
    
  openModal(modalHtml);
}

async function saveWaktuAbsen(kelasId) {
  const pStart = document.getElementById('m-pagi-start')?.value;
  const pEnd = document.getElementById('m-pagi-end')?.value;
  const mStart = document.getElementById('m-malam-start')?.value;
  const mEnd = document.getElementById('m-malam-end')?.value;
  const sStart = document.getElementById('m-sabtu-start')?.value;
  const sEnd = document.getElementById('m-sabtu-end')?.value;
  
  if (!pStart || !pEnd || !mStart || !mEnd || !sStart || !sEnd) {
    toast('Harap isi semua kolom waktu.', 'warning');
    return;
  }
  
  await DB.updateAbsenConfig(kelasId, {
    pagi_jam: pStart,
    pagi_start: pStart,
    pagi_end: pEnd,
    malam_jam: mStart,
    malam_start: mStart,
    malam_end: mEnd,
    sabtu_jam: sStart,
    sabtu_start: sStart,
    sabtu_end: sEnd
  });
  
  toast('✅ Waktu absen berhasil diperbarui!', 'success');
  closeModal();
  renderAdminView('waktu-absen');
}

// ============================================================
//  FITUR 1 — PENGUMUMAN / NOTIFIKASI (ADMIN)
// ============================================================
function buildPengumumanView() {
  const list = DB.getPengumumanAll();
  const rows = list.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Belum ada pengumuman.</td></tr>`
    : list.map(p => {
        const isExpired = p.expired_at && p.expired_at < new Date().toISOString();
        return `
        <tr>
          <td><span class="badge badge-${p.tipe === 'warning' ? 'warning' : p.tipe === 'danger' ? 'danger' : 'info'}">${p.tipe === 'warning' ? '⚠️ Peringatan' : p.tipe === 'danger' ? '🚨 Penting' : 'ℹ️ Info'}</span></td>
          <td><strong>${p.judul}</strong></td>
          <td style="max-width:300px;">${p.isi}</td>
          <td><span class="text-sm text-muted">${new Date(p.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span></td>
          <td><span class="badge ${isExpired ? 'badge-ghost' : 'badge-success'}">${isExpired ? 'Kadaluarsa' : 'Aktif'}</span></td>
          <td><button class="btn btn-danger btn-sm" onclick="hapusPengumuman('${p.id}')">🗑 Hapus</button></td>
        </tr>`;
      }).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">📢 Pengumuman & Notifikasi</h2>
      <p class="page-sub">Kelola pengumuman yang tampil di halaman semua staf</p>
    </div>

    <div class="card mb-6">
      <div class="card-header"><div class="card-title">➕ Buat Pengumuman Baru</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Judul Pengumuman <span class="req">*</span></label>
            <input type="text" class="form-control" id="peng-judul" placeholder="Contoh: Jadwal Libur Nasional">
          </div>
          <div class="form-group">
            <label class="form-label">Tipe</label>
            <select class="form-control" id="peng-tipe">
              <option value="info">ℹ️ Info</option>
              <option value="warning">⚠️ Peringatan</option>
              <option value="danger">🚨 Penting / Urgent</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Isi Pengumuman <span class="req">*</span></label>
          <textarea class="form-control" id="peng-isi" rows="3" placeholder="Tulis isi pengumuman di sini..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Berlaku Hingga (Opsional)</label>
          <input type="date" class="form-control" id="peng-expired" style="max-width:220px;">
          <span class="form-hint">Kosongkan jika tidak ada batas waktu.</span>
        </div>
        <button class="btn btn-primary" onclick="simpanPengumuman()">📢 Posting Pengumuman</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📋 Daftar Pengumuman</div><span class="badge badge-info">${list.length} total</span></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Tipe</th><th>Judul</th><th>Isi</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

async function simpanPengumuman() {
  const judul = document.getElementById('peng-judul')?.value?.trim();
  const isi   = document.getElementById('peng-isi')?.value?.trim();
  const tipe  = document.getElementById('peng-tipe')?.value;
  const exp   = document.getElementById('peng-expired')?.value;

  if (!judul || !isi) { toast('Judul dan isi pengumuman wajib diisi.', 'warning'); return; }

  await DB.addPengumuman({
    judul, isi, tipe,
    dibuat_oleh: App.user.nama,
    expired_at: exp ? exp + 'T23:59:59.000Z' : null
  });
  toast('✅ Pengumuman berhasil diposting!', 'success');
  renderAdminView('pengumuman');
}

async function hapusPengumuman(id) {
  if (!confirm('Hapus pengumuman ini?')) return;
  await DB.deletePengumuman(id);
  toast('Pengumuman dihapus.', 'info');
  renderAdminView('pengumuman');
}

// ============================================================
//  FITUR 2 — STATISTIK & GRAFIK (ADMIN)
// ============================================================
function buildStatistikView() {
  const today   = DB.today();
  const staff   = DB.getActiveStaff();
  const allLogs = DB.getLogs({});

  // Hitung 7 hari terakhir
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  // Rata-rata log/staf hari ini
  const todayLogs = allLogs.filter(l => l.tanggal === today);
  const avgLog = staff.length > 0 ? (todayLogs.length / staff.length).toFixed(1) : '0';

  // Total log minggu ini
  const weekLogs = allLogs.filter(l => last7.includes(l.tanggal)).length;

  // Staf paling aktif hari ini
  const staffAktif = staff.map(s => ({
    nama: s.nama.split(' ')[0],
    count: todayLogs.filter(l => l.staff_id === s.id).length
  })).sort((a, b) => b.count - a.count);
  const topStaf = staffAktif[0];

  return `
    <div class="page-hd">
      <h2 class="page-title">📈 Statistik & Grafik Aktivitas</h2>
      <p class="page-sub">Visualisasi data log aktivitas staf 7 hari terakhir</p>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card stat-primary">
        <div class="stat-emoji">📝</div>
        <div class="stat-value">${todayLogs.length}</div>
        <div class="stat-label">Total Log Hari Ini</div>
      </div>
      <div class="stat-card stat-gold">
        <div class="stat-emoji">📊</div>
        <div class="stat-value">${avgLog}</div>
        <div class="stat-label">Rata-rata Log/Staf</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-emoji">🗓️</div>
        <div class="stat-value">${weekLogs}</div>
        <div class="stat-label">Log Minggu Ini</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-emoji">🏆</div>
        <div class="stat-value">${topStaf?.nama || '—'}</div>
        <div class="stat-label">Staf Paling Aktif</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-header"><div class="card-title">📊 Log per Staf (Hari Ini)</div></div>
        <div class="card-body"><canvas id="chart-staf" height="220"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🍩 Distribusi Kategori Aktivitas</div></div>
        <div class="card-body"><canvas id="chart-kategori" height="220"></canvas></div>
      </div>
    </div>

    <div class="card mt-6">
      <div class="card-header"><div class="card-title">📈 Tren Log Aktivitas (7 Hari)</div></div>
      <div class="card-body"><canvas id="chart-tren" height="120"></canvas></div>
    </div>`;
}

function initCharts() {
  if (typeof Chart === 'undefined') {
    document.getElementById('chart-staf')?.closest('.card').insertAdjacentHTML('beforeend',
      '<p style="text-align:center;color:var(--text-muted);font-size:12px;">Chart.js tidak tersedia. Periksa koneksi internet.</p>');
    return;
  }
  Chart.defaults.color = '#a0a8b8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';

  const today   = DB.today();
  const staff   = DB.getActiveStaff();
  const allLogs = DB.getLogs({});
  const todayLogs = allLogs.filter(l => l.tanggal === today);

  // Chart 1: Bar — log per staf hari ini
  const staffNames = staff.map(s => s.nama.split(' ')[0]);
  const staffCounts = staff.map(s => todayLogs.filter(l => l.staff_id === s.id).length);
  const ctx1 = document.getElementById('chart-staf')?.getContext('2d');
  if (ctx1) new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: staffNames,
      datasets: [{ label: 'Jumlah Log', data: staffCounts,
        backgroundColor: 'rgba(200,160,60,0.7)', borderColor: '#c8a03c', borderWidth: 1, borderRadius: 6 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  // Chart 2: Doughnut — distribusi kategori hari ini
  const catMap = {};
  todayLogs.forEach(l => {
    const c = DB.getCategory(l.kategori);
    catMap[c.name] = (catMap[c.name] || 0) + 1;
  });
  const catLabels = Object.keys(catMap);
  const catData   = Object.values(catMap);
  const ctx2 = document.getElementById('chart-kategori')?.getContext('2d');
  if (ctx2) new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: catLabels.length ? catLabels : ['Belum ada data'],
      datasets: [{ data: catData.length ? catData : [1],
        backgroundColor: ['#c8a03c','#4a90d9','#2ecc71','#e74c3c','#9b59b6','#f39c12','#1abc9c','#e67e22'],
        borderWidth: 2, borderColor: '#0d1117' }]
    },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } }, cutout: '65%' }
  });

  // Chart 3: Line — tren log 7 hari
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const trendData = last7.map(d => allLogs.filter(l => l.tanggal === d).length);
  const trendLabels = last7.map(d => { const dt = new Date(d+'T00:00:00'); return `${dt.getDate()}/${dt.getMonth()+1}`; });
  const ctx3 = document.getElementById('chart-tren')?.getContext('2d');
  if (ctx3) new Chart(ctx3, {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{ label: 'Jumlah Log', data: trendData,
        borderColor: '#c8a03c', backgroundColor: 'rgba(200,160,60,0.15)',
        tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#c8a03c' }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// ============================================================
//  FITUR 3 — PENILAIAN STAF (ADMIN + STAFF)
// ============================================================
function buildPenilaianView() {
  const today = DB.today();
  const staff = DB.getActiveStaff();

  const rows = staff.map(s => {
    const nilai = DB.getPenilaianStafHari(s.id, today);
    const stars = nilai ? '⭐'.repeat(nilai.nilai) + `<span style="color:var(--gold-light);margin-left:4px;">${nilai.nilai}/5</span>` : '—';
    return `
      <tr>
        <td><div class="name-cell">
          <div class="av av-sm">${DB.getInitials(s.nama)}</div>
          <div class="name-cell-text"><div class="name-cell-main">${s.nama}</div><div class="name-cell-sub">${s.jabatan}</div></div>
        </div></td>
        <td>${stars}</td>
        <td style="max-width:200px;color:var(--text-muted);font-size:12px;">${nilai?.komentar || '—'}</td>
        <td><button class="btn btn-gold btn-sm" onclick="openModalPenilaian('${s.id}', '${s.nama.replace(/'/g,'&apos;')}')">⭐ Beri Nilai</button></td>
      </tr>`;
  }).join('');

  // Riwayat 7 hari
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const riwayat = DB.getPenilaian({});
  const riwayatRows = riwayat.filter(p => last7.includes(p.tanggal)).map(p => `
    <tr>
      <td>${p.staff_nama}</td>
      <td>${formatDateLong(p.tanggal)}</td>
      <td>${'⭐'.repeat(p.nilai)} <span style="color:var(--gold-light);">${p.nilai}/5</span></td>
      <td style="font-size:12px;color:var(--text-muted);">${p.komentar || '—'}</td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">⭐ Penilaian Kinerja Staf</h2>
      <p class="page-sub">Beri penilaian harian 1–5 bintang untuk setiap staf · ${formatDateLong(today)}</p>
    </div>

    <div class="card mb-6">
      <div class="card-header"><div class="card-title">👥 Nilai Staf Hari Ini</div></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Nama Staf</th><th>Nilai Hari Ini</th><th>Komentar</th><th>Aksi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📅 Riwayat Penilaian (7 Hari)</div></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Staf</th><th>Tanggal</th><th>Nilai</th><th>Komentar</th></tr></thead>
          <tbody>${riwayatRows || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Belum ada riwayat.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function openModalPenilaian(staffId, staffNama) {
  const today = DB.today();
  const existing = DB.getPenilaianStafHari(staffId, today);
  const modalHtml = `
    <div class="modal-box">
      <div class="modal-hd">
        <h3 class="modal-title">⭐ Beri Nilai — ${staffNama}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="text-align:left;">
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input type="date" class="form-control" id="m-nilai-tgl" value="${today}" max="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">Nilai (1–5 Bintang) <span class="req">*</span></label>
          <div class="star-picker" id="star-picker">
            ${[1,2,3,4,5].map(n => `
              <span class="star-btn ${existing && existing.nilai >= n ? 'active' : ''}" 
                data-val="${n}" onclick="pickStar(${n})">⭐</span>
            `).join('')}
          </div>
          <input type="hidden" id="m-nilai-val" value="${existing?.nilai || 0}">
        </div>
        <div class="form-group">
          <label class="form-label">Komentar (Opsional)</label>
          <textarea class="form-control" id="m-nilai-ket" rows="3" placeholder="Catatan kinerja staf hari ini...">${existing?.komentar || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-gold" onclick="simpanNilai('${staffId}', '${staffNama.replace(/'/g,'&apos;')}')">💾 Simpan Nilai</button>
      </div>
    </div>`;
  openModal(modalHtml);
}

function pickStar(val) {
  document.getElementById('m-nilai-val').value = val;
  qsa('.star-btn').forEach((s, i) => s.classList.toggle('active', i < val));
}

async function simpanNilai(staffId, staffNama) {
  const tgl   = document.getElementById('m-nilai-tgl')?.value;
  const nilai = parseInt(document.getElementById('m-nilai-val')?.value);
  const ket   = document.getElementById('m-nilai-ket')?.value?.trim();
  if (!tgl || !nilai || nilai < 1 || nilai > 5) { toast('Pilih nilai bintang terlebih dahulu.', 'warning'); return; }
  await DB.addPenilaian({ staff_id: staffId, staff_nama: staffNama, tanggal: tgl, nilai, komentar: ket });
  toast('✅ Nilai berhasil disimpan!', 'success');
  closeModal();
  renderAdminView('penilaian');
}

function buildNilaiSaya() {
  const riwayat = DB.getPenilaian({ staffId: App.user.id });
  const avg = riwayat.length > 0 ? (riwayat.reduce((s, p) => s + p.nilai, 0) / riwayat.length).toFixed(1) : null;
  const rows = riwayat.map(p => `
    <tr>
      <td>${formatDateLong(p.tanggal)}</td>
      <td>${'⭐'.repeat(p.nilai)} <span style="color:var(--gold-light);">${p.nilai}/5</span></td>
      <td style="font-size:12px;color:var(--text-muted);">${p.komentar || '—'}</td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">⭐ Riwayat Nilai Saya</h2>
      <p class="page-sub">Penilaian kinerja harian dari Manager Akademik</p>
    </div>
    ${avg ? `<div class="banner banner-info mb-4">🏆 Rata-rata nilai Anda: <strong>${avg} / 5 ⭐</strong> dari ${riwayat.length} penilaian.</div>` : ''}
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Tanggal</th><th>Nilai</th><th>Komentar Manager</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">Belum ada penilaian.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
//  FITUR 4 — JADWAL PIKET (ADMIN + STAFF)
// ============================================================
const AREA_PIKET = ['Asrama Putra', 'Asrama Putri', 'Kelas', 'Lapangan', 'Kantin', 'Lobby', 'Toilet Umum'];

function buildJadwalPiketView() {
  const today = DB.today();
  const staff = DB.getActiveStaff();

  // Bangun tabel minggu ini
  const ref = new Date(today + 'T00:00:00');
  const day = ref.getDay();
  const monday = new Date(ref); monday.setDate(ref.getDate() - (day === 0 ? 6 : day - 1));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const piketMinggu = DB.getPiket({ mingguOf: today });

  const weekCols = week.map(d => {
    const dt = new Date(d + 'T00:00:00');
    const isToday = d === today;
    const pList = piketMinggu.filter(p => p.tanggal === d);
    return `
      <td style="vertical-align:top;min-width:120px;padding:8px;background:${isToday ? 'rgba(200,160,60,0.08)' : 'transparent'};border:1px solid var(--border-sm);">
        <div style="font-size:11px;font-weight:700;color:${isToday ? 'var(--gold-light)' : 'var(--text-muted)'};margin-bottom:6px;">${DAYS_ID[dt.getDay()].slice(0,3)}, ${dt.getDate()}/${dt.getMonth()+1}</div>
        ${pList.length === 0 ? '<div style="font-size:11px;color:var(--text-muted);">—</div>' :
          pList.map(p => `
            <div style="font-size:11px;background:rgba(200,160,60,0.12);border-radius:4px;padding:4px 6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
              <span>${p.staff_nama.split(' ')[0]}<br><em style="color:var(--text-muted);">${p.area}</em></span>
              <button onclick="hapusPiket('${p.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px;">✕</button>
            </div>`).join('')
        }
      </td>`;
  }).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">🗓️ Jadwal Piket Staf</h2>
      <p class="page-sub">Kelola jadwal piket harian staf akademik</p>
    </div>

    <div class="card mb-6">
      <div class="card-header"><div class="card-title">➕ Tambah Jadwal Piket</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:end;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Staf <span class="req">*</span></label>
            <select class="form-control" id="piket-staff">
              <option value="">— Pilih Staf —</option>
              ${staff.map(s => `<option value="${s.id}|${s.nama}">${s.nama}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Tanggal <span class="req">*</span></label>
            <input type="date" class="form-control" id="piket-tgl" value="${today}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Area Piket <span class="req">*</span></label>
            <select class="form-control" id="piket-area">
              ${AREA_PIKET.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Catatan (Opsional)</label>
          <input type="text" class="form-control" id="piket-catatan" placeholder="Contoh: Fokus kebersihan area masuk">
        </div>
        <button class="btn btn-primary mt-2" onclick="tambahPiket()">🗓️ Tambah Jadwal</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📅 Kalender Minggu Ini</div></div>
      <div class="card-body" style="overflow-x:auto;">
        <table style="border-collapse:collapse;width:100%;"><tbody><tr>${weekCols}</tr></tbody></table>
      </div>
    </div>`;
}

async function tambahPiket() {
  const staffVal = document.getElementById('piket-staff')?.value;
  const tgl      = document.getElementById('piket-tgl')?.value;
  const area     = document.getElementById('piket-area')?.value;
  const catatan  = document.getElementById('piket-catatan')?.value?.trim();
  if (!staffVal || !tgl || !area) { toast('Staf, tanggal, dan area wajib diisi.', 'warning'); return; }
  const [staffId, staffNama] = staffVal.split('|');
  await DB.addPiket({ staff_id: staffId, staff_nama: staffNama, tanggal: tgl, area, catatan });
  toast('✅ Jadwal piket berhasil ditambahkan!', 'success');
  renderAdminView('jadwal-piket');
}

async function hapusPiket(id) {
  if (!confirm('Hapus jadwal piket ini?')) return;
  await DB.deletePiket(id);
  toast('Jadwal piket dihapus.', 'info');
  renderAdminView('jadwal-piket');
}

function buildPiketSaya() {
  const today = DB.today();
  const piketSaya = DB.getPiket({ staffId: App.user.id });
  const piketHariIni = piketSaya.filter(p => p.tanggal === today);
  const piketMendatang = piketSaya.filter(p => p.tanggal >= today).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const rows = piketMendatang.map(p => `
    <tr style="${p.tanggal === today ? 'background:rgba(200,160,60,0.08);' : ''}">
      <td>${formatDateLong(p.tanggal)} ${p.tanggal === today ? '<span class="badge badge-warning" style="margin-left:6px;">Hari Ini!</span>' : ''}</td>
      <td><span class="badge badge-info">${p.area}</span></td>
      <td style="font-size:12px;color:var(--text-muted);">${p.catatan || '—'}</td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">🗓️ Jadwal Piket Saya</h2>
      <p class="page-sub">Jadwal piket yang ditugaskan oleh Manager Akademik</p>
    </div>
    ${piketHariIni.length > 0 ? `
      <div class="banner banner-warning mb-4">🔔 <strong>Anda piket hari ini!</strong> Area: ${piketHariIni.map(p => p.area).join(', ')}</div>` : ''}
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Tanggal</th><th>Area Piket</th><th>Catatan</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">Tidak ada jadwal piket mendatang.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
//  FITUR 5 — IZIN / CUTI (ADMIN + STAFF)
// ============================================================
const JENIS_IZIN = ['Izin', 'Cuti', 'Sakit', 'Dinas Luar'];

function buildIzinSaya() {
  const today = DB.today();
  const izinList = DB.getIzin({ staffId: App.user.id });

  const statusBadge = s =>
    s === 'Disetujui' ? '<span class="badge badge-success">✅ Disetujui</span>' :
    s === 'Ditolak'   ? '<span class="badge badge-danger">❌ Ditolak</span>' :
                        '<span class="badge badge-warning">⏳ Menunggu</span>';

  const rows = izinList.map(i => `
    <tr>
      <td><span class="badge badge-info">${i.jenis}</span></td>
      <td>${formatDateLong(i.tgl_mulai)}${i.tgl_mulai !== i.tgl_selesai ? ' – ' + formatDateLong(i.tgl_selesai) : ''}</td>
      <td style="font-size:12px;max-width:200px;">${i.alasan}</td>
      <td>${statusBadge(i.status)}</td>
      <td style="font-size:12px;color:var(--text-muted);">${i.komentar_admin || '—'}</td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">📝 Pengajuan Izin / Cuti</h2>
      <p class="page-sub">Ajukan permohonan izin atau cuti untuk disetujui Manager Akademik</p>
    </div>

    <div class="card mb-6">
      <div class="card-header"><div class="card-title">➕ Ajukan Permohonan Baru</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Jenis <span class="req">*</span></label>
            <select class="form-control" id="izin-jenis">
              ${JENIS_IZIN.map(j => `<option value="${j}">${j}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mulai <span class="req">*</span></label>
            <input type="date" class="form-control" id="izin-mulai" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Selesai <span class="req">*</span></label>
            <input type="date" class="form-control" id="izin-selesai" value="${today}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alasan <span class="req">*</span></label>
          <textarea class="form-control" id="izin-alasan" rows="3" placeholder="Jelaskan alasan izin/cuti Anda secara singkat..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="ajukanIzin()">📤 Kirim Permohonan</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📋 Riwayat Permohonan Saya</div></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Jenis</th><th>Periode</th><th>Alasan</th><th>Status</th><th>Komentar Admin</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">Belum ada pengajuan.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function ajukanIzin() {
  const jenis    = document.getElementById('izin-jenis')?.value;
  const mulai    = document.getElementById('izin-mulai')?.value;
  const selesai  = document.getElementById('izin-selesai')?.value;
  const alasan   = document.getElementById('izin-alasan')?.value?.trim();
  if (!jenis || !mulai || !selesai || !alasan) { toast('Semua kolom wajib diisi.', 'warning'); return; }
  if (selesai < mulai) { toast('Tanggal selesai harus sama atau setelah tanggal mulai.', 'warning'); return; }
  await DB.addIzin({ staff_id: App.user.id, staff_nama: App.user.nama, jenis, tgl_mulai: mulai, tgl_selesai: selesai, alasan });
  toast('✅ Permohonan izin berhasil dikirim!', 'success');
  renderStaffView('izin-saya');
}

function buildIzinAdminView() {
  const izinList = DB.getIzin({});
  const pending  = izinList.filter(i => i.status === 'Menunggu').length;

  const statusBadge = s =>
    s === 'Disetujui' ? '<span class="badge badge-success">✅ Disetujui</span>' :
    s === 'Ditolak'   ? '<span class="badge badge-danger">❌ Ditolak</span>' :
                        '<span class="badge badge-warning">⏳ Menunggu</span>';

  const rows = izinList.map(i => `
    <tr>
      <td><div class="name-cell">
        <div class="av av-sm">${DB.getInitials(i.staff_nama)}</div>
        <div class="name-cell-text"><div class="name-cell-main">${i.staff_nama}</div></div>
      </div></td>
      <td><span class="badge badge-info">${i.jenis}</span></td>
      <td>${formatDateLong(i.tgl_mulai)}${i.tgl_mulai !== i.tgl_selesai ? '<br><span style="font-size:11px;color:var(--text-muted);">s/d ' + formatDateLong(i.tgl_selesai) + '</span>' : ''}</td>
      <td style="font-size:12px;max-width:180px;">${i.alasan}</td>
      <td>${statusBadge(i.status)}</td>
      <td>
        ${i.status === 'Menunggu' ? `
          <div style="display:flex;gap:6px;">
            <button class="btn btn-success btn-sm" onclick="prosesIzin('${i.id}','Disetujui')">✅</button>
            <button class="btn btn-danger btn-sm" onclick="prosesIzin('${i.id}','Ditolak')">❌</button>
          </div>` : `<span style="font-size:12px;color:var(--text-muted);">${i.komentar_admin || '—'}</span>`
        }
      </td>
    </tr>`).join('');

  return `
    <div class="page-hd">
      <h2 class="page-title">📋 Permohonan Izin / Cuti Staf</h2>
      <p class="page-sub">Setujui atau tolak permohonan izin dari staf akademik</p>
    </div>
    ${pending > 0 ? `<div class="banner banner-warning mb-4">⏳ Ada <strong>${pending} permohonan</strong> yang menunggu persetujuan Anda.</div>` : ''}
    <div class="card">
      <div class="card-header"><div class="card-title">📋 Semua Permohonan</div><span class="badge badge-ghost">${izinList.length} total</span></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Staf</th><th>Jenis</th><th>Periode</th><th>Alasan</th><th>Status</th><th>Aksi / Komentar</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">Belum ada permohonan.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function prosesIzin(id, status) {
  let komentar = '';
  if (status === 'Ditolak') {
    komentar = prompt('Berikan alasan penolakan (opsional):') || '';
  } else {
    komentar = prompt('Tambah komentar persetujuan (opsional):') || 'Disetujui oleh Manager Akademik.';
  }
  await DB.updateIzinStatus(id, status, komentar);
  toast(`✅ Permohonan berhasil ${status === 'Disetujui' ? 'disetujui' : 'ditolak'}!`, status === 'Disetujui' ? 'success' : 'danger');
  renderAdminView('permohonan-izin');
}

// ============================================================
//  FITUR: JADWAL SHIFT (Admin)
// ============================================================
function buildJadwalShiftView() {
  const today      = DB.today();
  const activeStaff = DB.getActiveStaff();

  // Ambil tanggal yang sedang dilihat dari state atau default hari ini
  if (!App._shiftViewDate) App._shiftViewDate = today;
  const viewDate = App._shiftViewDate;
  const shiftRec = DB.getShiftByTanggal(viewDate);

  const staffPagi  = shiftRec?.staff_pagi  || [];
  const staffSiang = shiftRec?.staff_siang || [];

  // Buat pilihan staf tersedia untuk setiap slot (belum diassign di shift manapun hari itu)
  const assignedAll  = [...staffPagi, ...staffSiang];
  const available    = activeStaff.filter(s => !assignedAll.includes(s.id));

  // Helper: render daftar staf di slot shift
  function renderSlotMembers(memberIds, shiftKey) {
    if (memberIds.length === 0) {
      return `<div class="shift-empty-slot">Belum ada staf yang diassign</div>`;
    }
    return memberIds.map(id => {
      const s = DB.getStaffById(id);
      if (!s) return '';
      return `
        <div class="shift-member-row">
          <div class="name-cell" style="flex:1">
            <div class="av av-sm">${DB.getInitials(s.nama)}</div>
            <div class="name-cell-text">
              <div class="name-cell-main">${s.nama}</div>
              <div class="name-cell-sub">${s.jabatan}</div>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="removeShiftMember('${viewDate}','${shiftKey}','${id}')" title="Hapus dari shift ini">✕</button>
        </div>`;
    }).join('');
  }

  // Build kalender mini 7 hari ke depan
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + i);
    // Hindari d.toISOString() karena akan mundur ke hari sebelumnya akibat UTC offset
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${day}`;
    const rec = DB.getShiftByTanggal(iso);
    const hasPagi  = rec?.staff_pagi?.length  > 0;
    const hasSiang = rec?.staff_siang?.length > 0;
    const isFull   = hasPagi && hasSiang;
    const isActive = iso === viewDate;
    return `
      <button class="shift-cal-btn ${isActive ? 'active' : ''} ${isFull ? 'full' : hasPagi || hasSiang ? 'partial' : ''}"
        onclick="shiftViewDate('${iso}')">
        <span class="shift-cal-day">${DAYS_ID[d.getDay()].slice(0,3)}</span>
        <span class="shift-cal-date">${String(d.getDate()).padStart(2,'0')}</span>
        <span class="shift-cal-status">
          ${isFull ? '✅' : hasPagi || hasSiang ? '⚠️' : '○'}
        </span>
      </button>`;
  }).join('');

  // Dropdown staf untuk tambah ke slot
  function addDropdown(shiftKey, currentMembers) {
    if (currentMembers.length >= 2) return `<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Slot penuh (maks. 2 staf)</p>`;
    const opts = activeStaff
      .filter(s => !assignedAll.includes(s.id))
      .map(s => `<option value="${s.id}">${s.nama} — ${s.jabatan}</option>`)
      .join('');
    if (!opts) return `<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Semua staf sudah diassign</p>`;
    return `
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
        <select class="form-control" id="add-shift-sel-${shiftKey}" style="flex:1;font-size:13px;">
          <option value="">— Pilih staf —</option>
          ${opts}
        </select>
        <button class="btn btn-primary btn-sm" onclick="addShiftMember('${viewDate}','${shiftKey}')">+ Tambah</button>
      </div>`;
  }

  return `
    <div class="page-hd">
      <h2 class="page-title">🕐 Jadwal Shift Staf</h2>
      <p class="page-sub">Atur pembagian shift harian · Shift Pagi 10:00–13:00 &nbsp;·&nbsp; Shift Siang 13:00–16:00</p>
    </div>

    <div class="banner banner-info mb-4" style="font-size:13px;">
      ℹ️ Setiap hari ada <strong>2 staf shift pagi (10:00–13:00)</strong> dan <strong>2 staf shift siang (13:00–16:00)</strong>. Manager mengatur siapa yang bertugas di shift mana.
    </div>

    <!-- Kalender mini 7 hari -->
    <div class="card mb-4">
      <div class="card-header">
        <div class="card-title">📅 Pilih Tanggal</div>
        <span class="badge badge-ghost">${formatDateLong(viewDate)}</span>
      </div>
      <div class="card-body">
        <div class="shift-cal-row">${weekDays}</div>
        <div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--text-muted);">
          <span>✅ Lengkap</span><span>⚠️ Sebagian</span><span>○ Belum diisi</span>
        </div>
      </div>
    </div>

    <!-- Panel Shift -->
    <div class="shift-panels-grid">
      <!-- Shift Pagi -->
      <div class="card shift-panel shift-panel-pagi">
        <div class="card-header">
          <div class="card-title">🌅 Shift Pagi</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="shift-badge shift-pagi" style="font-size:11px;">10:00 – 13:00</span>
            <span class="badge ${staffPagi.length >= 2 ? 'badge-success' : staffPagi.length > 0 ? 'badge-warning' : 'badge-ghost'}">${staffPagi.length}/2 staf</span>
          </div>
        </div>
        <div class="card-body">
          <div class="shift-members-list" id="shift-pagi-list">
            ${renderSlotMembers(staffPagi, 'pagi')}
          </div>
          ${addDropdown('pagi', staffPagi)}
        </div>
      </div>

      <!-- Shift Siang -->
      <div class="card shift-panel shift-panel-siang">
        <div class="card-header">
          <div class="card-title">☀️ Shift Siang</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="shift-badge shift-siang" style="font-size:11px;">13:00 – 16:00</span>
            <span class="badge ${staffSiang.length >= 2 ? 'badge-success' : staffSiang.length > 0 ? 'badge-warning' : 'badge-ghost'}">${staffSiang.length}/2 staf</span>
          </div>
        </div>
        <div class="card-body">
          <div class="shift-members-list" id="shift-siang-list">
            ${renderSlotMembers(staffSiang, 'siang')}
          </div>
          ${addDropdown('siang', staffSiang)}
        </div>
      </div>
    </div>

    <!-- Ringkasan jadwal staf minggu ini -->
    <div class="card mt-4">
      <div class="card-header">
        <div class="card-title">👥 Ringkasan Shift Staf Aktif</div>
        <span class="badge badge-ghost">Hari ini · ${formatDateLong(today)}</span>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Nama Staf</th>
              <th>Jabatan</th>
              <th>Shift Hari Ini</th>
              <th>Jam</th>
            </tr>
          </thead>
          <tbody>
            ${activeStaff.map(s => {
              const shiftType = DB.getShiftStaffToday(s.id);
              const cfg = shiftType ? SHIFT_CONFIG[shiftType] : null;
              return `
                <tr>
                  <td>
                    <div class="name-cell">
                      <div class="av av-sm">${DB.getInitials(s.nama)}</div>
                      <span class="td-strong">${s.nama}</span>
                    </div>
                  </td>
                  <td class="text-sm">${s.jabatan}</td>
                  <td>
                    ${cfg
                      ? `<span class="shift-badge ${cfg.colorClass}">${cfg.emoji} ${cfg.label}</span>`
                      : '<span class="badge badge-ghost">Tidak ada shift</span>'}
                  </td>
                  <td class="text-sm text-muted">${cfg ? `${cfg.jam_mulai} – ${cfg.jam_selesai}` : '—'}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function shiftViewDate(iso) {
  App._shiftViewDate = iso;
  renderAdminView('jadwal-shift');
}

async function addShiftMember(tanggal, shiftKey) {
  const selId = `add-shift-sel-${shiftKey}`;
  const sel = document.getElementById(selId);
  const staffId = sel?.value;
  if (!staffId) { toast('Pilih staf terlebih dahulu', 'warning'); return; }

  const rec = DB.getShiftByTanggal(tanggal) || { staff_pagi: [], staff_siang: [] };
  const staffPagi  = [...(rec.staff_pagi  || [])];
  const staffSiang = [...(rec.staff_siang || [])];

  // Cek apakah sudah ada di shift lain
  if (staffPagi.includes(staffId) || staffSiang.includes(staffId)) {
    toast('Staf ini sudah ada di shift hari tersebut!', 'warning'); return;
  }

  if (shiftKey === 'pagi') {
    if (staffPagi.length >= 2) { toast('Shift pagi sudah penuh (maks. 2 staf)', 'warning'); return; }
    staffPagi.push(staffId);
  } else {
    if (staffSiang.length >= 2) { toast('Shift siang sudah penuh (maks. 2 staf)', 'warning'); return; }
    staffSiang.push(staffId);
  }

  await DB.setShift({ tanggal, staff_pagi: staffPagi, staff_siang: staffSiang, dibuat_oleh: App.user?.nama || 'Manager' });
  const s = DB.getStaffById(staffId);
  toast(`✅ ${s?.nama || 'Staf'} berhasil ditambahkan ke ${shiftKey === 'pagi' ? 'Shift Pagi' : 'Shift Siang'}`, 'success');
  renderAdminView('jadwal-shift');
}

async function removeShiftMember(tanggal, shiftKey, staffId) {
  const s = DB.getStaffById(staffId);
  if (!confirm(`Hapus ${s?.nama || 'staf ini'} dari ${shiftKey === 'pagi' ? 'Shift Pagi' : 'Shift Siang'}?`)) return;

  const rec = DB.getShiftByTanggal(tanggal) || { staff_pagi: [], staff_siang: [] };
  let staffPagi  = [...(rec.staff_pagi  || [])];
  let staffSiang = [...(rec.staff_siang || [])];

  if (shiftKey === 'pagi')  staffPagi  = staffPagi.filter(id => id !== staffId);
  else                      staffSiang = staffSiang.filter(id => id !== staffId);

  await DB.setShift({ tanggal, staff_pagi: staffPagi, staff_siang: staffSiang, dibuat_oleh: App.user?.nama || 'Manager' });
  toast(`🗑️ ${s?.nama || 'Staf'} dihapus dari shift`, 'info');
  renderAdminView('jadwal-shift');
}

// ============================================================
//  FITUR 6 — EXPORT LAPORAN & BACKUP
// ============================================================
function downloadLocalBackup() {
  const backupData = JSON.stringify(DB.cache, null, 2);
  const blob = new Blob([backupData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AkademikAPP_FullBackup_${DB.today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ File Backup berhasil didownload!', 'success');
}

function exportLogsToExcel(filterParams) {
  if (typeof XLSX === 'undefined') { toast('Library XLSX tidak tersedia. Periksa koneksi internet.', 'danger'); return; }
  const logs = DB.getLogs(filterParams || App.logFilter || {});
  if (logs.length === 0) { toast('Tidak ada data untuk di-export.', 'warning'); return; }

  const wsData = [
    ['No', 'Tanggal', 'Jam', 'Nama Staf', 'Jabatan', 'Kategori', 'Deskripsi']
  ];
  logs.forEach((l, i) => {
    const cat = DB.getCategory(l.kategori);
    const s   = DB.getStaffById(l.staff_id);
    let desc  = l.deskripsi || '';
    if (desc.startsWith('{')) try { const d = JSON.parse(desc); desc = `[Checklist] ${d.metadata?.subject || ''} ${d.metadata?.pic_dosen || ''}`.trim(); } catch(e) {}
    wsData.push([i + 1, l.tanggal, l.jam, l.staff_nama, s?.jabatan || '—', cat.name, desc]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Log Aktivitas');
  XLSX.writeFile(wb, `AkademikAPP_Log_${DB.today()}.xlsx`);
  toast('📥 File Excel berhasil diunduh!', 'success');
}

function exportLogsToPDF(filterParams) {
  if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    toast('Library jsPDF tidak tersedia. Periksa koneksi internet.', 'danger'); return;
  }
  const logs = DB.getLogs(filterParams || App.logFilter || {});
  if (logs.length === 0) { toast('Tidak ada data untuk di-export.', 'warning'); return; }

  const { jsPDF: JPDF } = window.jspdf || { jsPDF };
  const doc = new JPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setTextColor(200, 160, 60);
  doc.text('TIA AkademikAPP — Log Aktivitas Staf', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 150);
  doc.text(`Triesakti Institute of Airlines · Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

  const head = [['No', 'Tanggal', 'Jam', 'Nama Staf', 'Kategori', 'Deskripsi']];
  const body = logs.map((l, i) => {
    const cat = DB.getCategory(l.kategori);
    let desc = l.deskripsi || '';
    if (desc.startsWith('{')) try { const d = JSON.parse(desc); desc = `[Checklist] ${d.metadata?.subject || ''}`.trim(); } catch(e) {}
    return [i + 1, l.tanggal, l.jam, l.staff_nama, cat.name, desc.slice(0, 80)];
  });

  doc.autoTable({
    head, body, startY: 28, styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [200, 160, 60], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 24 }, 2: { cellWidth: 14 }, 3: { cellWidth: 40 }, 4: { cellWidth: 45 }, 5: { cellWidth: 'auto' } }
  });

  doc.save(`AkademikAPP_Log_${DB.today()}.pdf`);
  toast('📄 File PDF berhasil diunduh!', 'success');
}

function exportRekapToExcel() {
  if (typeof XLSX === 'undefined') { toast('Library XLSX tidak tersedia.', 'danger'); return; }
  const tanggal = App.rekapFilter?.tanggal || DB.today();
  const sesi    = App.rekapFilter?.sesi || '';
  const absen   = DB.getAbsenMentoring({ tanggal, ...(sesi ? { sesi } : {}) });
  if (absen.length === 0) { toast('Tidak ada data absen untuk di-export.', 'warning'); return; }

  const wsData = [['No', 'Tanggal', 'Sesi', 'Nama Staf Mentor', 'NIM Siswa', 'Nama Siswa', 'Status', 'Catatan']];
  absen.forEach((a, i) => wsData.push([i+1, a.tanggal, a.sesi, a.staff_nama, a.siswa_nim, a.siswa_nama, a.status, a.catatan || '']));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:4},{wch:12},{wch:8},{wch:24},{wch:14},{wch:24},{wch:14},{wch:40}];
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absen');
  XLSX.writeFile(wb, `AkademikAPP_RekapAbsen_${tanggal}.xlsx`);
  toast('📥 Rekap absen berhasil diunduh!', 'success');
}

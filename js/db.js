/* ============================================================
   db.js — Data Layer for AkademikAPP
   Triesakti Institute of Airlines
   All data synced with Supabase (Online) and persisted in localStorage as fallback.
   
   -- SQL SCHEMA FOR SUPABASE SQL EDITOR --
   
   CREATE TABLE public.tia_master_staff (
     id text PRIMARY KEY,
     nama text NOT NULL,
     jabatan text NOT NULL,
     status text NOT NULL DEFAULT 'Aktif',
     pin text NOT NULL DEFAULT '1234'
   );

   CREATE TABLE public.tia_log_aktivitas (
     id text PRIMARY KEY,
     staff_id text NOT NULL,
     staff_nama text NOT NULL,
     tanggal text NOT NULL,
     jam text NOT NULL,
     kategori text NOT NULL,
     deskripsi text,
     created_at text NOT NULL
   );

   CREATE TABLE public.tia_checklist_kelas (
     id text PRIMARY KEY,
     room_id text NOT NULL,
     tanggal text NOT NULL,
     staff_id text NOT NULL,
     staff_nama text NOT NULL,
     items jsonb NOT NULL,
     submitted boolean NOT NULL DEFAULT false,
     submitted_at text
   );

   -- Disable RLS for rapid testing/prototype:
   ALTER TABLE public.tia_master_staff DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_log_aktivitas DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_checklist_kelas DISABLE ROW LEVEL SECURITY;
   ============================================================ */

'use strict';

// ==========================================
// SUPABASE CLIENT CONFIGURATION
// ==========================================
// PENTING: Isi URL dan Anon Key Supabase Anda di bawah ini agar online.
// Jika dikosongkan, aplikasi otomatis fallback ke LocalStorage (Offline mode).
const SUPABASE_URL = 'https://dgxoiqqaxdnvmdphzfxt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRneG9pcXFheGRudm1kcGh6Znh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTkxMTcsImV4cCI6MjA5NTkzNTExN30.8lSOD2axFyqbuw_m4b0xTE3SihzBGEHnyCEJu76gOT0';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Gagal menginisialisasi Supabase:", err);
  }
}

// ===========================
// STORAGE KEYS
// ===========================
const DB_KEYS = {
  STAFF:     'tia_master_staff',
  LOGS:      'tia_log_aktivitas',
  CHECKLIST: 'tia_checklist_kelas'
};

// ===========================
// STATIC CONSTANTS
// ===========================

/** 6 rooms for Triesakti Institute of Airlines */
const ROOMS = [
  { id: 'kelas-garuda',   name: 'Kelas Garuda',   icon: '🦅' },
  { id: 'kelas-citilink', name: 'Kelas Citilink',  icon: '✈️' },
  { id: 'aula',           name: 'Aula',            icon: '🏛️' },
  { id: 'lapangan',       name: 'Lapangan',        icon: '⛳' },
  { id: 'teras-aspura',   name: 'Teras Aspura',    icon: '🌿' },
  { id: 'lab-komputer',   name: 'Lab. Komputer',   icon: '💻' }
];

/** 8 structured activity checkpoint slots */
const TIME_SLOTS = [
  '05:00',
  '06:15',
  '07:30',
  '09:30',
  '12:45',
  '16:00',
  '20:00',
  '22:00'
];

const ACTIVITY_CATS = [
  // Pukul 05:00
  { id: 'kehadiran-pagi',     name: 'Kehadiran Kelas Pagi',      icon: '👥' },
  { id: 'materi-pagi',        name: 'Materi Kelas Pagi',         icon: '📖' },
  { id: 'catatan-pagi',       name: 'Catatan Khusus Kelas Pagi', icon: '📝' },
  
  // Pukul 06:15
  { id: 'olahraga-pagi',      name: 'Jenis Olahraga Pagi',       icon: '🏃' },
  
  // Pukul 07:30
  { id: 'kesiapan-1',         name: 'Checklist Kelas Pagi 1',    icon: '🏫' },
  
  // Pukul 09:30
  { id: 'kesiapan-2',         name: 'Checklist Kelas Pagi 2',    icon: '🏫' },
  
  // Pukul 12:45
  { id: 'kesiapan-3',         name: 'Checklist Kelas Sore',      icon: '🏫' },
  
  // Pukul 16:00
  { id: 'ekskul-sore',        name: 'Kegiatan Ekstrakurikuler',  icon: '⚽' },
  { id: 'catatan-ekskul',     name: 'Catatan Kegiatan Ekstrakurikuler', icon: '✍️' },
  { id: 'kesiapan-sore-opt',  name: 'Checklist Kelas Sore (Optional)', icon: '🏫' },
  
  // Pukul 20:00
  { id: 'kehadiran-malam',    name: 'Kehadiran Kelas Malam',     icon: '🌙' },
  { id: 'materi-malam',       name: 'Materi Kelas Malam',        icon: '📚' },
  { id: 'kesiapan-malam',     name: 'Checklist Kelas Malam',     icon: '🏫' },
  { id: 'catatan-malam',      name: 'Catatan Khusus Kelas Malam', icon: '⚠️' },
  
  // Pukul 22:00
  { id: 'absen-asrama',       name: 'Absen Asrama',              icon: '🏢' },
  { id: 'catatan-asrama',     name: 'Catatan Absen Asrama',      icon: '📋' }
];

/**
 * Checklist items.
 * skipFor: room IDs where this item should NOT appear.
 */
const CHECKLIST_ITEMS = [
  { id: 'ac',         name: 'AC / Ventilasi Udara Berfungsi',    icon: '❄️', skipFor: ['lapangan','teras-aspura'] },
  { id: 'proyektor',  name: 'Proyektor / TV Menyala',            icon: '📽️', skipFor: ['lapangan','teras-aspura'] },
  { id: 'whiteboard', name: 'Whiteboard & Spidol Tersedia',       icon: '📋', skipFor: ['lapangan','teras-aspura'] },
  { id: 'modul',      name: 'Modul / Materi Ajar Siap',           icon: '📚', skipFor: [] },
  { id: 'absensi',    name: 'Absensi Siswa Siap',                 icon: '📝', skipFor: [] },
  { id: 'wifi',       name: 'Koneksi Internet / WiFi Aktif',      icon: '📶', skipFor: ['lapangan','teras-aspura'] },
  { id: 'kebersihan', name: 'Kebersihan Ruangan / Area',          icon: '🧹', skipFor: [] },
  { id: 'meja-kursi', name: 'Kursi & Meja Lengkap & Tertata',     icon: '🪑', skipFor: ['lapangan'] },
  { id: 'komputer',   name: 'Peralatan Komputer Siap',            icon: '💻', skipFor: ['kelas-garuda','kelas-citilink','aula','lapangan','teras-aspura'] },
  { id: 'audio',      name: 'Sistem Audio (Mic / Speaker)',        icon: '🔊', skipFor: ['kelas-garuda','kelas-citilink','lapangan','teras-aspura'] }
];

/** Default seed staff for fresh install */
const DEFAULT_STAFF = [
  { id: 'STF001', nama: 'Ahmad Fauzi',        jabatan: 'Koordinator Akademik', status: 'Aktif', pin: '1234' },
  { id: 'STF002', nama: 'Sari Dewi Rahayu',   jabatan: 'Staf Pengajar',        status: 'Aktif', pin: '1234' },
  { id: 'STF003', nama: 'Budi Santoso',        jabatan: 'Staf Pengajar',        status: 'Aktif', pin: '1234' },
  { id: 'STF004', nama: 'Rina Kusuma Wardani', jabatan: 'Admin Akademik',       status: 'Aktif', pin: '1234' },
  { id: 'STF005', nama: 'Dian Pratama',        jabatan: 'Staf Pengajar',        status: 'Aktif', pin: '1234' },
  { id: 'STF006', nama: 'Fitri Handayani',     jabatan: 'Admin Akademik',       status: 'Aktif', pin: '1234' }
];

// ===========================
// DATABASE OBJECT
// ===========================
const DB = {
  // Synchronous cache for UI rendering
  cache: {
    staff: [],
    logs: [],
    checklists: []
  },

  /** Initialize cache with local data & seed default staff once */
  init() {
    this.cache.staff = JSON.parse(localStorage.getItem(DB_KEYS.STAFF) || '[]');
    this.cache.logs = JSON.parse(localStorage.getItem(DB_KEYS.LOGS) || '[]');
    this.cache.checklists = JSON.parse(localStorage.getItem(DB_KEYS.CHECKLIST) || '[]');

    // Seed only once on the first app boot
    if (!localStorage.getItem('tia_app_seeded')) {
      this.cache.staff = [...DEFAULT_STAFF];
      localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));
      localStorage.setItem('tia_app_seeded', 'true');
    }
  },

  /** Fetch fresh data from Supabase and sync local storage */
  async syncFromCloud() {
    if (!supabaseClient) {
      console.log("Supabase belum dikonfigurasi. Menggunakan data offline LocalStorage.");
      this.init();
      return false; // Not connected
    }
    try {
      // 1. Ambil Data Staf
      const { data: staffData, error: staffErr } = await supabaseClient
        .from('tia_master_staff')
        .select('*');
      if (staffErr) throw staffErr;
      this.cache.staff = staffData || [];

      // 2. Ambil Data Logs
      const { data: logsData, error: logsErr } = await supabaseClient
        .from('tia_log_aktivitas')
        .select('*');
      if (logsErr) throw logsErr;
      this.cache.logs = logsData || [];

      // 3. Ambil Data Checklist
      const { data: clData, error: clErr } = await supabaseClient
        .from('tia_checklist_kelas')
        .select('*');
      if (clErr) throw clErr;
      this.cache.checklists = clData || [];

      // Update backup local storage
      localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));
      localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));
      localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(this.cache.checklists));

      console.log("Database Supabase berhasil disinkronisasi!");
      return true; // Successfully synced
    } catch (err) {
      console.warn("Gagal sinkronisasi Supabase. Fallback ke LocalStorage:", err);
      this.init();
      return false;
    }
  },

  // ── STAFF CRUD ──────────────────────────────────────

  getAllStaff() {
    return this.cache.staff;
  },

  getActiveStaff() {
    return this.getAllStaff().filter(s => s.status === 'Aktif');
  },

  getStaffById(id) {
    return this.getAllStaff().find(s => s.id === id) || null;
  },

  async addStaff({ nama, jabatan, pin }) {
    const staff = {
      id: 'STF' + Date.now().toString().slice(-8),
      nama: nama.trim(),
      jabatan,
      status: 'Aktif',
      pin: (pin || '1234').trim()
    };
    this.cache.staff.push(staff);
    localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));

    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_master_staff').insert([staff]);
      } catch (err) {
        console.error("Cloud insert staff failed:", err);
      }
    }
    return staff;
  },

  async updateStaff(id, updates) {
    const list = this.cache.staff;
    const i = list.findIndex(s => s.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...updates };
    localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(list));

    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_master_staff').update(updates).eq('id', id);
      } catch (err) {
        console.error("Cloud update staff failed:", err);
      }
    }
    return list[i];
  },

  async toggleStaffStatus(id) {
    const s = this.getStaffById(id);
    if (!s) return null;
    return await this.updateStaff(id, { status: s.status === 'Aktif' ? 'Nonaktif' : 'Aktif' });
  },

  async deleteStaff(id) {
    this.cache.staff = this.cache.staff.filter(s => s.id !== id);
    localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));

    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_master_staff').delete().eq('id', id);
      } catch (err) {
        console.error("Cloud delete staff failed:", err);
      }
    }
    return true;
  },

  // ── ACTIVITY LOGS ────────────────────────────────────

  getLogs({ tanggal, staffId } = {}) {
    let logs = this.cache.logs;
    if (tanggal)  logs = logs.filter(l => l.tanggal  === tanggal);
    if (staffId)  logs = logs.filter(l => l.staff_id === staffId);
    return logs.sort((a, b) => a.jam.localeCompare(b.jam));
  },

  async addLog({ staff_id, staff_nama, tanggal, jam, kategori, deskripsi }) {
    const entry = {
      id: 'LOG' + Date.now(),
      staff_id,
      staff_nama,
      tanggal,
      jam,
      kategori,
      deskripsi: deskripsi || '',
      created_at: new Date().toISOString()
    };
    this.cache.logs.push(entry);
    localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));

    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_log_aktivitas').insert([entry]);
      } catch (err) {
        console.error("Cloud add log failed:", err);
      }
    }
    return entry;
  },

  isSlotFilled(staffId, tanggal, jam) {
    return this.getLogs({ staffId, tanggal }).some(l => l.jam === jam);
  },

  isCategoryLogged(staffId, tanggal, jam, kategori) {
    return this.getLogs({ staffId, tanggal }).some(l => l.jam === jam && l.kategori === kategori);
  },

  getStaffLogsToday(staffId) {
    return this.getLogs({ staffId, tanggal: this.today() });
  },

  // ── CHECKLISTS ───────────────────────────────────────

  getChecklists({ tanggal, roomId } = {}) {
    let list = this.cache.checklists;
    if (tanggal) list = list.filter(c => c.tanggal  === tanggal);
    if (roomId)  list = list.filter(c => c.room_id  === roomId);
    return list;
  },

  getChecklistByRoomToday(roomId) {
    const list = this.getChecklists({ tanggal: this.today(), roomId });
    return list[0] || null;
  },

  getAllChecklistsToday() {
    return this.getChecklists({ tanggal: this.today() });
  },

  async saveChecklist({ room_id, tanggal, staff_id, staff_nama, items }) {
    const list = this.cache.checklists;
    const i = list.findIndex(c => c.tanggal === tanggal && c.room_id === room_id);
    let record;
    if (i !== -1) {
      list[i] = { ...list[i], staff_id, staff_nama, items };
      record = list[i];
    } else {
      record = {
        id: 'CHK' + Date.now(),
        room_id,
        tanggal,
        staff_id,
        staff_nama,
        items,
        submitted: false,
        submitted_at: null
      };
      list.push(record);
    }
    localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));

    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_checklist_kelas').upsert([record]);
      } catch (err) {
        console.error("Cloud save checklist failed:", err);
      }
    }
  },

  async submitChecklist(roomId) {
    const list = this.cache.checklists;
    const i = list.findIndex(c => c.tanggal === this.today() && c.room_id === roomId);
    if (i === -1) return null;
    list[i].submitted    = true;
    list[i].submitted_at = new Date().toISOString();
    localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));

    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_checklist_kelas').upsert([list[i]]);
      } catch (err) {
        console.error("Cloud submit checklist failed:", err);
      }
    }
    return list[i];
  },

  // ── HELPERS ──────────────────────────────────────────

  today() {
    return new Date().toISOString().split('T')[0];
  },

  getInitials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  },

  getCategory(id) {
    return ACTIVITY_CATS.find(c => c.id === id) || { id, name: id, icon: '📌' };
  },

  getRoomItems(roomId) {
    return CHECKLIST_ITEMS.filter(item => !item.skipFor.includes(roomId));
  }
};

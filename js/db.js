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

   CREATE TABLE public.tia_siswa_aktif (
     nim     text PRIMARY KEY,
     nama    text NOT NULL,
     kelas   text NOT NULL,
     program text NOT NULL,
     status  text NOT NULL DEFAULT 'Aktif'
   );

   CREATE TABLE public.tia_mentor_assign (
     id        text PRIMARY KEY,
     staff_id  text NOT NULL,
     siswa_nim text NOT NULL
   );

   CREATE TABLE public.tia_absen_mentoring (
     id         text PRIMARY KEY,
     staff_id   text NOT NULL,
     staff_nama text NOT NULL,
     siswa_nim  text NOT NULL,
     siswa_nama text NOT NULL,
     tanggal    text NOT NULL,
     sesi       text NOT NULL,
     status     text NOT NULL,
     catatan    text,
     created_at text NOT NULL
   );

   -- Disable RLS for rapid testing/prototype:
   ALTER TABLE public.tia_master_staff DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_log_aktivitas DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_checklist_kelas DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_siswa_aktif DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_mentor_assign DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_absen_mentoring DISABLE ROW LEVEL SECURITY;
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
  STAFF:           'tia_master_staff',
  LOGS:            'tia_log_aktivitas',
  CHECKLIST:       'tia_checklist_kelas',
  SISWA:           'tia_siswa_aktif',
  MENTOR_ASSIGN:   'tia_mentor_assign',
  ABSEN_MENTORING: 'tia_absen_mentoring',
  STAFF_KELAS:     'tia_staff_kelas_assign',
  SISWA_KELAS:     'tia_siswa_kelas_assign'
};

// ===========================
// SISWA CONSTANTS
// ===========================
const KELAS_OPTIONS = [
  'Garuda A', 'Garuda B', 'Garuda C',
  'Citilink A', 'Citilink B', 'Citilink C',
  'Angkatan 2022', 'Angkatan 2023', 'Angkatan 2024', 'Angkatan 2025'
];

const PROGRAM_OPTIONS = [
  'Ground Handling',
  'Cabin Crew',
  'Airport Service',
  'Ticketing & Reservation',
  'Aviation Security',
  'Air Traffic Control',
  'Aircraft Maintenance'
];

/** 4 Kelas Mentoring — pengelompokan siswa ke dalam mentor tertentu */
const KELAS_MENTORING = [
  { id: 'zurich',    nama: 'Kelas Zurich',    icon: '🇨🇭', accent: '#e63946' },
  { id: 'frankfurt', nama: 'Kelas Frankfurt', icon: '🇩🇪', accent: '#457b9d' },
  { id: 'narita',    nama: 'Kelas Narita',    icon: '🇯🇵', accent: '#e9c46a' },
  { id: 'vancouver', nama: 'Kelas Vancouver', icon: '🇨🇦', accent: '#2a9d8f' },
];

/** Sesi absen mentoring dan jendela waktu yang diizinkan */
const ABSEN_SESI = {
  pagi:  { label: 'Pagi',  jam: '05:00', windowStart: '05:00', windowEnd: '06:59' },
  malam: { label: 'Malam', jam: '20:00', windowStart: '20:00', windowEnd: '21:59' }
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
    checklists: [],
    siswa: [],
    mentorAssigns: [],
    absenMentoring: [],
    staffKelas: [],
    siswaKelas: []
  },

  /** Initialize cache with local data & seed default staff once */
  init() {
    this.cache.staff          = JSON.parse(localStorage.getItem(DB_KEYS.STAFF) || '[]');
    this.cache.logs           = JSON.parse(localStorage.getItem(DB_KEYS.LOGS) || '[]');
    this.cache.checklists     = JSON.parse(localStorage.getItem(DB_KEYS.CHECKLIST) || '[]');
    this.cache.siswa          = JSON.parse(localStorage.getItem(DB_KEYS.SISWA) || '[]');
    this.cache.mentorAssigns  = JSON.parse(localStorage.getItem(DB_KEYS.MENTOR_ASSIGN) || '[]');
    this.cache.absenMentoring = JSON.parse(localStorage.getItem(DB_KEYS.ABSEN_MENTORING) || '[]');
    this.cache.staffKelas     = JSON.parse(localStorage.getItem(DB_KEYS.STAFF_KELAS) || '[]');
    this.cache.siswaKelas     = JSON.parse(localStorage.getItem(DB_KEYS.SISWA_KELAS) || '[]');

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

      // 2. Ambil Data Logs dari Cloud
      const { data: cloudLogs, error: logsErr } = await supabaseClient
        .from('tia_log_aktivitas')
        .select('*');
      if (logsErr) throw logsErr;
      
      const cloudLogsMap = new Map(cloudLogs.map(l => [l.id, l]));
      const localLogs = JSON.parse(localStorage.getItem(DB_KEYS.LOGS) || '[]');
      
      // Ambil log lokal yang belum tersinkronisasi
      const unsyncedLogs = localLogs.filter(l => l._unsynced);
      
      for (const log of unsyncedLogs) {
        try {
          const existsInCloud = cloudLogsMap.has(log.id);
          let error;
          
          // Hapus flag _unsynced sebelum dikirim ke cloud agar data bersih
          const cleanLog = { ...log };
          delete cleanLog._unsynced;
          
          if (existsInCloud) {
            const { error: err } = await supabaseClient
              .from('tia_log_aktivitas')
              .update(cleanLog)
              .eq('id', log.id);
            error = err;
          } else {
            const { error: err } = await supabaseClient
              .from('tia_log_aktivitas')
              .insert([cleanLog]);
            error = err;
          }
          
          if (error) throw error;
          
          // Jika sukses, hapus flag _unsynced dari log lokal
          delete log._unsynced;
          cloudLogsMap.set(log.id, cleanLog);
        } catch (err) {
          console.error(`Gagal menyinkronkan log ${log.id} ke cloud:`, err);
          // Tetap masukkan log lokal yang unsynced ke map hasil agar tidak terhapus
          cloudLogsMap.set(log.id, log);
        }
      }
      
      this.cache.logs = Array.from(cloudLogsMap.values());

      // 3. Ambil Data Checklist dari Cloud
      const { data: cloudChecklists, error: clErr } = await supabaseClient
        .from('tia_checklist_kelas')
        .select('*');
      if (clErr) throw clErr;
      
      const cloudClMap = new Map(cloudChecklists.map(c => [c.id, c]));
      const localChecklists = JSON.parse(localStorage.getItem(DB_KEYS.CHECKLIST) || '[]');
      const unsyncedCl = localChecklists.filter(c => c._unsynced);
      
      for (const cl of unsyncedCl) {
        try {
          const cleanCl = { ...cl };
          delete cleanCl._unsynced;
          
          const { error } = await supabaseClient
            .from('tia_checklist_kelas')
            .upsert([cleanCl]);
          if (error) throw error;
          
          delete cl._unsynced;
          cloudClMap.set(cl.id, cleanCl);
        } catch (err) {
          console.error(`Gagal menyinkronkan checklist ${cl.id} ke cloud:`, err);
          cloudClMap.set(cl.id, cl);
        }
      }
      
      this.cache.checklists = Array.from(cloudClMap.values());

      // 4. Ambil Data Siswa dari Cloud
      const { data: siswaData, error: siswaErr } = await supabaseClient
        .from('tia_siswa_aktif')
        .select('*');
      if (siswaErr) throw siswaErr;
      this.cache.siswa = siswaData || [];

      // 5. Ambil Data Mentor Assign dari Cloud
      const { data: assignData, error: assignErr } = await supabaseClient
        .from('tia_mentor_assign')
        .select('*');
      if (assignErr) throw assignErr;
      this.cache.mentorAssigns = assignData || [];

      // 6. Sync Absen Mentoring (local → cloud)
      const { data: cloudAbsen, error: absenErr } = await supabaseClient
        .from('tia_absen_mentoring')
        .select('*');
      if (absenErr) throw absenErr;

      const cloudAbsenMap = new Map(cloudAbsen.map(a => [a.id, a]));
      const localAbsen = JSON.parse(localStorage.getItem(DB_KEYS.ABSEN_MENTORING) || '[]');
      const unsyncedAbsen = localAbsen.filter(a => a._unsynced);

      for (const ab of unsyncedAbsen) {
        try {
          const clean = { ...ab };
          delete clean._unsynced;
          const { error } = await supabaseClient.from('tia_absen_mentoring').upsert([clean]);
          if (error) throw error;
          delete ab._unsynced;
          cloudAbsenMap.set(ab.id, clean);
        } catch (err) {
          console.error(`Gagal sync absen ${ab.id}:`, err);
          cloudAbsenMap.set(ab.id, ab);
        }
      }
      this.cache.absenMentoring = Array.from(cloudAbsenMap.values());

      // 7. Ambil Data Staff Kelas Assign dari Cloud
      const { data: staffKelasData, error: skErr } = await supabaseClient
        .from('tia_staff_kelas_assign')
        .select('*');
      if (skErr) throw skErr;
      this.cache.staffKelas = staffKelasData || [];

      // 8. Ambil Data Siswa Kelas Assign dari Cloud
      const { data: siswaKelasData, error: szkErr } = await supabaseClient
        .from('tia_siswa_kelas_assign')
        .select('*');
      if (szkErr) throw szkErr;
      this.cache.siswaKelas = siswaKelasData || [];

      // Update backup local storage
      localStorage.setItem(DB_KEYS.STAFF,           JSON.stringify(this.cache.staff));
      localStorage.setItem(DB_KEYS.LOGS,            JSON.stringify(this.cache.logs));
      localStorage.setItem(DB_KEYS.CHECKLIST,       JSON.stringify(this.cache.checklists));
      localStorage.setItem(DB_KEYS.SISWA,           JSON.stringify(this.cache.siswa));
      localStorage.setItem(DB_KEYS.MENTOR_ASSIGN,   JSON.stringify(this.cache.mentorAssigns));
      localStorage.setItem(DB_KEYS.ABSEN_MENTORING, JSON.stringify(this.cache.absenMentoring));
      localStorage.setItem(DB_KEYS.STAFF_KELAS,     JSON.stringify(this.cache.staffKelas));
      localStorage.setItem(DB_KEYS.SISWA_KELAS,     JSON.stringify(this.cache.siswaKelas));

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

  getLogs({ tanggal, startDate, endDate, staffId, kategori } = {}) {
    let logs = this.cache.logs;
    if (tanggal)   logs = logs.filter(l => l.tanggal  === tanggal);
    if (startDate) logs = logs.filter(l => l.tanggal >= startDate);
    if (endDate)   logs = logs.filter(l => l.tanggal <= endDate);
    if (staffId)   logs = logs.filter(l => l.staff_id === staffId);
    if (kategori)  logs = logs.filter(l => l.kategori === kategori);
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
        const { error } = await supabaseClient.from('tia_log_aktivitas').insert([entry]);
        if (error) throw error;
        delete entry._unsynced;
        localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));
      } catch (err) {
        console.error("Cloud add log failed:", err);
        entry._unsynced = true;
        localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));
      }
    } else {
      entry._unsynced = true;
      localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));
    }
    return entry;
  },

  async updateLog(id, updates) {
    const list = this.cache.logs;
    const i = list.findIndex(l => l.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...updates };
    localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(list));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tia_log_aktivitas').update(updates).eq('id', id);
        if (error) throw error;
        delete list[i]._unsynced;
        localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(list));
      } catch (err) {
        console.error("Cloud update log failed:", err);
        list[i]._unsynced = true;
        localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(list));
      }
    } else {
      list[i]._unsynced = true;
      localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(list));
    }
    return list[i];
  },

  async deleteAllLogs() {
    this.cache.logs = [];
    localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tia_log_aktivitas').delete().neq('id', 'dummy');
        if (error) throw error;
      } catch (err) {
        console.error("Cloud delete all logs failed:", err);
      }
    }
    return true;
  },

  async deleteStaffLogs(staffId) {
    this.cache.logs = this.cache.logs.filter(l => l.staff_id !== staffId);
    localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(this.cache.logs));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tia_log_aktivitas').delete().eq('staff_id', staffId);
        if (error) throw error;
      } catch (err) {
        console.error("Cloud delete staff logs failed:", err);
      }
    }
    return true;
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
        const { error } = await supabaseClient.from('tia_checklist_kelas').upsert([record]);
        if (error) throw error;
        delete record._unsynced;
        localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));
      } catch (err) {
        console.error("Cloud save checklist failed:", err);
        record._unsynced = true;
        localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));
      }
    } else {
      record._unsynced = true;
      localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));
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
        const { error } = await supabaseClient.from('tia_checklist_kelas').upsert([list[i]]);
        if (error) throw error;
        delete list[i]._unsynced;
        localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));
      } catch (err) {
        console.error("Cloud submit checklist failed:", err);
        list[i]._unsynced = true;
        localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));
      }
    } else {
      list[i]._unsynced = true;
      localStorage.setItem(DB_KEYS.CHECKLIST, JSON.stringify(list));
    }
    return list[i];
  },

  // ── SISWA CRUD ───────────────────────────────────────

  getAllSiswa() {
    return this.cache.siswa;
  },

  getActiveSiswa() {
    return this.getAllSiswa().filter(s => s.status === 'Aktif');
  },

  getSiswaByNim(nim) {
    return this.getAllSiswa().find(s => s.nim === nim) || null;
  },

  async addSiswa({ nim, nama, kelas, program }) {
    if (this.getSiswaByNim(nim)) {
      throw new Error('NIM sudah terdaftar');
    }
    const siswa = { nim: nim.trim(), nama: nama.trim(), kelas, program, status: 'Aktif' };
    this.cache.siswa.push(siswa);
    localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(this.cache.siswa));
    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_siswa_aktif').insert([siswa]);
      } catch (err) { console.error('Cloud insert siswa failed:', err); }
    }
    return siswa;
  },

  async updateSiswa(nim, updates) {
    const list = this.cache.siswa;
    const i = list.findIndex(s => s.nim === nim);
    if (i === -1) return null;
    list[i] = { ...list[i], ...updates };
    localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(list));
    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_siswa_aktif').update(updates).eq('nim', nim);
      } catch (err) { console.error('Cloud update siswa failed:', err); }
    }
    return list[i];
  },

  async toggleSiswaStatus(nim) {
    const s = this.getSiswaByNim(nim);
    if (!s) return null;
    return await this.updateSiswa(nim, { status: s.status === 'Aktif' ? 'Nonaktif' : 'Aktif' });
  },

  async deleteSiswa(nim) {
    this.cache.siswa = this.cache.siswa.filter(s => s.nim !== nim);
    // Hapus juga assign terkait
    this.cache.mentorAssigns = this.cache.mentorAssigns.filter(a => a.siswa_nim !== nim);
    localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(this.cache.siswa));
    localStorage.setItem(DB_KEYS.MENTOR_ASSIGN, JSON.stringify(this.cache.mentorAssigns));
    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_siswa_aktif').delete().eq('nim', nim);
        await supabaseClient.from('tia_mentor_assign').delete().eq('siswa_nim', nim);
      } catch (err) { console.error('Cloud delete siswa failed:', err); }
    }
    return true;
  },

  // ── MENTOR ASSIGN ────────────────────────────────────

  /** Kembalikan array NIM siswa yang diassign ke staffId */
  getMentorAssign(staffId) {
    return this.cache.mentorAssigns
      .filter(a => a.staff_id === staffId)
      .map(a => a.siswa_nim);
  },

  /** Kembalikan semua assign dalam format {staff_id, siswa_nim}[] */
  getAllMentorAssigns() {
    return this.cache.mentorAssigns;
  },

  /**
   * Simpan/replace seluruh assignment untuk satu staf.
   * nimArray: string[] daftar NIM yang diassign.
   */
  async setMentorAssign(staffId, nimArray) {
    // Hapus assign lama untuk staf ini
    this.cache.mentorAssigns = this.cache.mentorAssigns.filter(a => a.staff_id !== staffId);
    // Buat assign baru
    const newAssigns = nimArray.map(nim => ({
      id:       `MA_${staffId}_${nim}`,
      staff_id: staffId,
      siswa_nim: nim
    }));
    this.cache.mentorAssigns.push(...newAssigns);
    localStorage.setItem(DB_KEYS.MENTOR_ASSIGN, JSON.stringify(this.cache.mentorAssigns));

    if (supabaseClient) {
      try {
        // Hapus assign lama di cloud
        await supabaseClient.from('tia_mentor_assign').delete().eq('staff_id', staffId);
        // Insert baru jika ada
        if (newAssigns.length > 0) {
          await supabaseClient.from('tia_mentor_assign').insert(newAssigns);
        }
      } catch (err) { console.error('Cloud set mentor assign failed:', err); }
    }
    return newAssigns;
  },

  // ── ABSEN MENTORING ──────────────────────────────────

  getAbsenMentoring({ staffId, tanggal, sesi } = {}) {
    let list = this.cache.absenMentoring;
    if (staffId) list = list.filter(a => a.staff_id === staffId);
    if (tanggal) list = list.filter(a => a.tanggal  === tanggal);
    if (sesi)    list = list.filter(a => a.sesi     === sesi);
    return list;
  },

  /** Simpan atau update satu record absen mentoring */
  async saveAbsenMentoring({ staff_id, staff_nama, siswa_nim, siswa_nama, tanggal, sesi, status, catatan }) {
    const id = `ABM_${staff_id}_${siswa_nim}_${tanggal}_${sesi}`;
    const list = this.cache.absenMentoring;
    const i = list.findIndex(a => a.id === id);
    const record = { id, staff_id, staff_nama, siswa_nim, siswa_nama, tanggal, sesi, status, catatan: catatan || '', created_at: new Date().toISOString() };

    if (i !== -1) {
      list[i] = record;
    } else {
      list.push(record);
    }
    localStorage.setItem(DB_KEYS.ABSEN_MENTORING, JSON.stringify(list));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tia_absen_mentoring').upsert([record]);
        if (error) throw error;
        delete record._unsynced;
        localStorage.setItem(DB_KEYS.ABSEN_MENTORING, JSON.stringify(list));
      } catch (err) {
        console.error('Cloud save absen mentoring failed:', err);
        record._unsynced = true;
        localStorage.setItem(DB_KEYS.ABSEN_MENTORING, JSON.stringify(list));
      }
    } else {
      record._unsynced = true;
      localStorage.setItem(DB_KEYS.ABSEN_MENTORING, JSON.stringify(list));
    }
    return record;
  },

  // ── KELAS MENTORING ──────────────────────────────────────

  /** Kembalikan kelas_id yang diassign untuk staffId, atau null */
  getStaffKelasId(staffId) {
    return this.cache.staffKelas.find(a => a.staff_id === staffId)?.kelas_id || null;
  },

  /**
   * Set atau update assignment staff ke kelas.
   * Jika kelasId = null/kosong, hapus assignment staff tsb.
   */
  async setStaffKelas(staffId, kelasId) {
    this.cache.staffKelas = this.cache.staffKelas.filter(a => a.staff_id !== staffId);
    if (kelasId) {
      const record = { id: `SKA_${staffId}`, staff_id: staffId, kelas_id: kelasId };
      this.cache.staffKelas.push(record);
    }
    localStorage.setItem(DB_KEYS.STAFF_KELAS, JSON.stringify(this.cache.staffKelas));
    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_staff_kelas_assign').delete().eq('staff_id', staffId);
        if (kelasId) {
          await supabaseClient.from('tia_staff_kelas_assign')
            .insert([{ id: `SKA_${staffId}`, staff_id: staffId, kelas_id: kelasId }]);
        }
      } catch (err) { console.error('Cloud set staff kelas failed:', err); }
    }
  },

  /** Kembalikan array NIM siswa yang ada di kelas tertentu */
  getSiswaByKelasId(kelasId) {
    return this.cache.siswaKelas
      .filter(a => a.kelas_id === kelasId)
      .map(a => a.siswa_nim);
  },

  /** Kembalikan kelas_id untuk seorang siswa (NIM), atau null */
  getSiswaKelasId(nim) {
    return this.cache.siswaKelas.find(a => a.siswa_nim === nim)?.kelas_id || null;
  },

  /**
   * Replace seluruh daftar siswa di kelas tertentu.
   * nimArray: string[] daftar NIM yang akan dimasukkan ke kelas.
   */
  async setSiswaKelas(kelasId, nimArray) {
    // Hapus semua siswa lama di kelas ini
    this.cache.siswaKelas = this.cache.siswaKelas.filter(a => a.kelas_id !== kelasId);
    // Buat assign baru
    const newAssigns = nimArray.map(nim => ({
      id:        `SZA_${kelasId}_${nim}`,
      siswa_nim: nim,
      kelas_id:  kelasId
    }));
    this.cache.siswaKelas.push(...newAssigns);
    localStorage.setItem(DB_KEYS.SISWA_KELAS, JSON.stringify(this.cache.siswaKelas));
    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_siswa_kelas_assign').delete().eq('kelas_id', kelasId);
        if (newAssigns.length > 0) {
          await supabaseClient.from('tia_siswa_kelas_assign').insert(newAssigns);
        }
      } catch (err) { console.error('Cloud set siswa kelas failed:', err); }
    }
    return newAssigns;
  },

  /**
   * Kembalikan array NIM siswa untuk staf berdasarkan kelas yang diassign.
   * Digunakan oleh tampilan Absen Pagi/Malam di staf view.
   */
  getMentorStudents(staffId) {
    const kelasId = this.getStaffKelasId(staffId);
    if (!kelasId) return [];
    return this.getSiswaByKelasId(kelasId);
  },

  // ── HELPERS ──────────────────────────────────────────

  /** Tanggal hari ini YYYY-MM-DD berdasarkan timezone WITA (UTC+8) */
  today() {
    // Paksa ke WITA (Asia/Makassar = UTC+8) agar konsisten di semua perangkat
    const wita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
    const year  = wita.getFullYear();
    const month = String(wita.getMonth() + 1).padStart(2, '0');
    const day   = String(wita.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /** HH:MM string dari waktu saat ini berdasarkan WITA (UTC+8) */
  nowHHMM() {
    const wita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
    return String(wita.getHours()).padStart(2,'0') + ':' + String(wita.getMinutes()).padStart(2,'0');
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

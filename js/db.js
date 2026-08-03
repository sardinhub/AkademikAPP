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

   CREATE TABLE public.tia_staff_kelas_assign (
     id text PRIMARY KEY,
     staff_id text NOT NULL,
     kelas_id text NOT NULL
   );

   CREATE TABLE public.tia_siswa_kelas_assign (
     id text PRIMARY KEY,
     siswa_nim text NOT NULL,
     kelas_id text NOT NULL
   );

   CREATE TABLE public.tia_jadwal_shift (
     id          text PRIMARY KEY,
     tanggal     text NOT NULL,
     staff_pagi  jsonb NOT NULL DEFAULT '[]',
     staff_siang jsonb NOT NULL DEFAULT '[]',
     dibuat_oleh text,
     created_at  text NOT NULL
   );

   -- Disable RLS for rapid testing/prototype:
   ALTER TABLE public.tia_master_staff DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_log_aktivitas DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_checklist_kelas DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_siswa_aktif DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_mentor_assign DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_absen_mentoring DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_staff_kelas_assign DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_siswa_kelas_assign DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tia_jadwal_shift DISABLE ROW LEVEL SECURITY;
   ============================================================ */

'use strict';

// ==========================================
// SUPABASE CLIENT CONFIGURATION
// ==========================================
// PENTING: Isi URL dan Anon Key Supabase Anda di bawah ini agar online.
// Jika dikosongkan, aplikasi otomatis fallback ke LocalStorage (Offline mode).
const SUPABASE_URL = 'https://zdopgyaxorlmciupampm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkb3BneWF4b3JsbWNpdXBhbXBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDg5NjQsImV4cCI6MjEwMTMyNDk2NH0.RZSeqAuT_iTnptUug5Qhepzwy8cD-f-7ByVYSGan_TE';

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
  SISWA_KELAS:     'tia_siswa_kelas_assign',
  ABSEN_CONFIG:    'tia_absen_config',
  // ── Fitur Baru ──
  PENGUMUMAN:      'tia_pengumuman',
  PENILAIAN:       'tia_penilaian_staf',
  PIKET:           'tia_jadwal_piket',
  IZIN:            'tia_izin_staf',
  SHIFT:           'tia_jadwal_shift'
};

// ===========================
// SISWA CONSTANTS
// ===========================
const KELAS_OPTIONS = [
  'GS38', 'GS39', 'GS40',
  'AV08', 'FA10'
];

const PROGRAM_OPTIONS = [
  'Ground Staff',
  'AVSEC',
  'Flight Attendant'
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
  malam: { label: 'Malam', jam: '20:00', windowStart: '20:00', windowEnd: '21:59' },
  sabtu: { label: 'Sabtu Pagi', jam: '09:00', windowStart: '09:00', windowEnd: '11:59' }
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

// Data dummy staf telah dihapus — data staf dikelola murni melalui form tambah staf atau sinkronisasi Supabase.

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
    siswaKelas: [],
    absenConfig: [],
    // ── Fitur Baru ──
    pengumuman: [],
    penilaian: [],
    piket: [],
    izin: [],
    shift: []
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
    this.cache.absenConfig    = JSON.parse(localStorage.getItem(DB_KEYS.ABSEN_CONFIG) || '[]');
    this.cache.pengumuman     = JSON.parse(localStorage.getItem(DB_KEYS.PENGUMUMAN) || '[]');
    this.cache.penilaian      = JSON.parse(localStorage.getItem(DB_KEYS.PENILAIAN) || '[]');
    this.cache.piket          = JSON.parse(localStorage.getItem(DB_KEYS.PIKET) || '[]');
    this.cache.izin           = JSON.parse(localStorage.getItem(DB_KEYS.IZIN) || '[]');
    this.cache.shift          = JSON.parse(localStorage.getItem(DB_KEYS.SHIFT) || '[]');

    if (this.cache.absenConfig.length === 0) {
      KELAS_MENTORING.forEach(km => {
        this.cache.absenConfig.push({
          kelas_id: km.id,
          pagi_jam: '05:00', pagi_start: '05:00', pagi_end: '06:59',
          malam_jam: '20:00', malam_start: '20:00', malam_end: '21:59'
        });
      });
      localStorage.setItem(DB_KEYS.ABSEN_CONFIG, JSON.stringify(this.cache.absenConfig));
    }
    // Bersihkan flag lama dan data dummy staf (STF001-STF006) dari localStorage
    const DUMMY_IDS = ['STF001','STF002','STF003','STF004','STF005','STF006'];
    if (localStorage.getItem('tia_app_seeded')) {
      this.cache.staff = this.cache.staff.filter(s => !DUMMY_IDS.includes(s.id));
      localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));
      localStorage.removeItem('tia_app_seeded');
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
      // 1. Sync Data Staf (local -> cloud)
      console.log('[SYNC] Step 1: tia_master_staff...');
      const { data: cloudStaff, error: staffErr } = await supabaseClient
        .from('tia_master_staff')
        .select('*');
      if (staffErr) { console.error('[SYNC] ❌ Step 1 gagal:', staffErr.message, staffErr); throw staffErr; }
      
      const cloudStaffMap = new Map(cloudStaff.map(s => [s.id, s]));

      // Hapus data dummy STF001-STF006 dari Supabase jika masih ada
      const DUMMY_IDS = ['STF001','STF002','STF003','STF004','STF005','STF006'];
      const dummyInCloud = DUMMY_IDS.filter(id => cloudStaffMap.has(id));
      for (const dId of dummyInCloud) {
        try {
          await supabaseClient.from('tia_master_staff').delete().eq('id', dId);
          cloudStaffMap.delete(dId);
          console.log(`Data dummy staf ${dId} berhasil dihapus dari Supabase.`);
        } catch (err) {
          console.warn(`Gagal hapus dummy staf ${dId} dari Supabase:`, err);
        }
      }

      const localStaff = JSON.parse(localStorage.getItem(DB_KEYS.STAFF) || '[]');
      const unsyncedStaff = localStaff.filter(s => s._unsynced || !cloudStaffMap.has(s.id));
      
      for (const st of unsyncedStaff) {
        try {
          const cleanSt = { ...st };
          delete cleanSt._unsynced;
          const { error } = await supabaseClient.from('tia_master_staff').upsert([cleanSt]);
          if (error) throw error;
          delete st._unsynced;
          cloudStaffMap.set(st.id, cleanSt);
        } catch (err) {
          console.error(`Gagal sync staff ${st.id}:`, err);
          cloudStaffMap.set(st.id, st);
        }
      }
      this.cache.staff = Array.from(cloudStaffMap.values());

      // 2. Ambil Data Logs dari Cloud
      console.log('[SYNC] Step 2: tia_log_aktivitas...');
      const { data: cloudLogs, error: logsErr } = await supabaseClient
        .from('tia_log_aktivitas')
        .select('*');
      if (logsErr) { console.error('[SYNC] ❌ Step 2 gagal:', logsErr.message, logsErr); throw logsErr; }
      
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
      console.log('[SYNC] Step 3: tia_checklist_kelas...');
      const { data: cloudChecklists, error: clErr } = await supabaseClient
        .from('tia_checklist_kelas')
        .select('*');
      if (clErr) { console.error('[SYNC] ❌ Step 3 gagal:', clErr.message, clErr); throw clErr; }
      
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

      // 4. Sync Data Siswa (local -> cloud)
      console.log('[SYNC] Step 4: tia_siswa_aktif...');
      const { data: cloudSiswa, error: siswaErr } = await supabaseClient
        .from('tia_siswa_aktif')
        .select('*');
      if (siswaErr) { console.error('[SYNC] ❌ Step 4 gagal:', siswaErr.message, siswaErr); throw siswaErr; }
      
      const cloudSiswaMap = new Map(cloudSiswa.map(s => [s.nim, s]));
      const localSiswa = JSON.parse(localStorage.getItem(DB_KEYS.SISWA) || '[]');
      const unsyncedSiswa = localSiswa.filter(s => s._unsynced || !cloudSiswaMap.has(s.nim));
      
      for (const sw of unsyncedSiswa) {
        try {
          const cleanSw = { ...sw };
          delete cleanSw._unsynced;
          const { error } = await supabaseClient.from('tia_siswa_aktif').upsert([cleanSw]);
          if (error) throw error;
          delete sw._unsynced;
          cloudSiswaMap.set(sw.nim, cleanSw);
        } catch (err) {
          console.error(`Gagal sync siswa ${sw.nim}:`, err);
          cloudSiswaMap.set(sw.nim, sw);
        }
      }
      this.cache.siswa = Array.from(cloudSiswaMap.values());

      // 5. Sync Data Mentor Assign (local -> cloud)
      console.log('[SYNC] Step 5: tia_mentor_assign...');
      const { data: cloudAssigns, error: assignErr } = await supabaseClient
        .from('tia_mentor_assign')
        .select('*');
      if (assignErr) { console.error('[SYNC] ❌ Step 5 gagal:', assignErr.message, assignErr); throw assignErr; }
      
      const cloudAssignMap = new Map(cloudAssigns.map(a => [a.id, a]));
      const localAssigns = JSON.parse(localStorage.getItem(DB_KEYS.MENTOR_ASSIGN) || '[]');
      const unsyncedAssigns = localAssigns.filter(a => a._unsynced || !cloudAssignMap.has(a.id));
      
      for (const asn of unsyncedAssigns) {
        try {
          const cleanAsn = { ...asn };
          delete cleanAsn._unsynced;
          const { error } = await supabaseClient.from('tia_mentor_assign').upsert([cleanAsn]);
          if (error) throw error;
          delete asn._unsynced;
          cloudAssignMap.set(asn.id, cleanAsn);
        } catch (err) {
          console.error(`Gagal sync assign ${asn.id}:`, err);
          cloudAssignMap.set(asn.id, asn);
        }
      }
      this.cache.mentorAssigns = Array.from(cloudAssignMap.values());

      // 6. Sync Absen Mentoring (local → cloud)
      console.log('[SYNC] Step 6: tia_absen_mentoring...');
      const { data: cloudAbsen, error: absenErr } = await supabaseClient
        .from('tia_absen_mentoring')
        .select('*');
      if (absenErr) { console.error('[SYNC] ❌ Step 6 gagal:', absenErr.message, absenErr); throw absenErr; }

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

      // 7. Sync Data Staff Kelas Assign (local -> cloud)
      console.log('[SYNC] Step 7: tia_staff_kelas_assign...');
      const { data: cloudStaffKelas, error: skErr } = await supabaseClient
        .from('tia_staff_kelas_assign')
        .select('*');
      if (skErr) { console.error('[SYNC] ❌ Step 7 gagal:', skErr.message, skErr); throw skErr; }
      
      const cloudSkMap = new Map(cloudStaffKelas.map(k => [k.id, k]));
      const localStaffKelas = JSON.parse(localStorage.getItem(DB_KEYS.STAFF_KELAS) || '[]');
      const unsyncedStaffKelas = localStaffKelas.filter(k => k._unsynced || !cloudSkMap.has(k.id));
      
      for (const sk of unsyncedStaffKelas) {
        try {
          const cleanSk = { ...sk };
          delete cleanSk._unsynced;
          const { error } = await supabaseClient.from('tia_staff_kelas_assign').upsert([cleanSk]);
          if (error) throw error;
          delete sk._unsynced;
          cloudSkMap.set(sk.id, cleanSk);
        } catch (err) {
          console.error(`Gagal sync staff kelas ${sk.id}:`, err);
          cloudSkMap.set(sk.id, sk);
        }
      }
      this.cache.staffKelas = Array.from(cloudSkMap.values());

      // 8. Sync Data Siswa Kelas Assign (local -> cloud)
      console.log('[SYNC] Step 8: tia_siswa_kelas_assign...');
      const { data: cloudSiswaKelas, error: szkErr } = await supabaseClient
        .from('tia_siswa_kelas_assign')
        .select('*');
      if (szkErr) { console.error('[SYNC] ❌ Step 8 gagal:', szkErr.message, szkErr); throw szkErr; }
      
      const cloudSzkMap = new Map(cloudSiswaKelas.map(k => [k.id, k]));
      const localSiswaKelas = JSON.parse(localStorage.getItem(DB_KEYS.SISWA_KELAS) || '[]');
      const unsyncedSiswaKelas = localSiswaKelas.filter(k => k._unsynced || !cloudSzkMap.has(k.id));
      
      for (const szk of unsyncedSiswaKelas) {
        try {
          const cleanSzk = { ...szk };
          delete cleanSzk._unsynced;
          const { error } = await supabaseClient.from('tia_siswa_kelas_assign').upsert([cleanSzk]);
          if (error) throw error;
          delete szk._unsynced;
          cloudSzkMap.set(szk.id, cleanSzk);
        } catch (err) {
          console.error(`Gagal sync siswa kelas ${szk.id}:`, err);
          cloudSzkMap.set(szk.id, szk);
        }
      }
      this.cache.siswaKelas = Array.from(cloudSzkMap.values());

      // 9. Sync Absen Config (local -> cloud)
      console.log('[SYNC] Step 9: tia_absen_config...');
      const { data: cloudCfg, error: cfgErr } = await supabaseClient
        .from('tia_absen_config')
        .select('*');
      if (cfgErr) console.warn('[SYNC] ⚠️ Step 9 (absen_config) tidak tersedia:', cfgErr.message);
      if (!cfgErr && cloudCfg) {
        const cloudCfgMap = new Map(cloudCfg.map(c => [c.kelas_id, c]));
        const localCfg = JSON.parse(localStorage.getItem(DB_KEYS.ABSEN_CONFIG) || '[]');
        const unsyncedCfg = localCfg.filter(c => c._unsynced || !cloudCfgMap.has(c.kelas_id));
        
        for (const cfg of unsyncedCfg) {
          try {
            const cleanCfg = { ...cfg };
            delete cleanCfg._unsynced;
            const { error } = await supabaseClient.from('tia_absen_config').upsert([cleanCfg]);
            if (!error) {
              delete cfg._unsynced;
              cloudCfgMap.set(cfg.kelas_id, cleanCfg);
            } else {
              cloudCfgMap.set(cfg.kelas_id, cfg);
            }
          } catch (err) {
            cloudCfgMap.set(cfg.kelas_id, cfg);
          }
        }
        
        // Populate missing configs from default if not in cloud
        KELAS_MENTORING.forEach(km => {
          if (!cloudCfgMap.has(km.id)) {
            cloudCfgMap.set(km.id, {
              kelas_id: km.id,
              pagi_jam: '05:00', pagi_start: '05:00', pagi_end: '06:59',
              malam_jam: '20:00', malam_start: '20:00', malam_end: '21:59'
            });
          }
        });
        
        this.cache.absenConfig = Array.from(cloudCfgMap.values());
      }

      // 10. Sync Pengumuman
      console.log('[SYNC] Step 10: tia_pengumuman...');
      const { data: cloudPengumuman, error: pengErr } = await supabaseClient.from('tia_pengumuman').select('*');
      if (!pengErr && cloudPengumuman) {
        const localPengumuman = JSON.parse(localStorage.getItem(DB_KEYS.PENGUMUMAN) || '[]');
        const cpMap = new Map(cloudPengumuman.map(p => [p.id, p]));
        const unsyncedP = localPengumuman.filter(p => p._unsynced);
        for (const p of unsyncedP) {
          try {
            const clean = { ...p }; delete clean._unsynced;
            const { error } = await supabaseClient.from('tia_pengumuman').upsert([clean]);
            if (!error) { delete p._unsynced; cpMap.set(p.id, clean); }
          } catch(e) { cpMap.set(p.id, p); }
        }
        this.cache.pengumuman = Array.from(cpMap.values());
      } else {
        if (pengErr) console.warn('[SYNC] ⚠️ Step 10 (pengumuman):', pengErr.message);
        this.cache.pengumuman = JSON.parse(localStorage.getItem(DB_KEYS.PENGUMUMAN) || '[]');
      }

      // 11. Sync Penilaian Staf
      console.log('[SYNC] Step 11: tia_penilaian_staf...');
      const { data: cloudPenilaian, error: penErr } = await supabaseClient.from('tia_penilaian_staf').select('*');
      if (!penErr && cloudPenilaian) {
        const localPenilaian = JSON.parse(localStorage.getItem(DB_KEYS.PENILAIAN) || '[]');
        const penMap = new Map(cloudPenilaian.map(p => [p.id, p]));
        const unsyncedPen = localPenilaian.filter(p => p._unsynced);
        for (const p of unsyncedPen) {
          try {
            const clean = { ...p }; delete clean._unsynced;
            const { error } = await supabaseClient.from('tia_penilaian_staf').upsert([clean]);
            if (!error) { delete p._unsynced; penMap.set(p.id, clean); }
          } catch(e) { penMap.set(p.id, p); }
        }
        this.cache.penilaian = Array.from(penMap.values());
      } else {
        if (penErr) console.warn('[SYNC] ⚠️ Step 11 (penilaian):', penErr.message);
        this.cache.penilaian = JSON.parse(localStorage.getItem(DB_KEYS.PENILAIAN) || '[]');
      }

      // 12. Sync Jadwal Piket
      console.log('[SYNC] Step 12: tia_jadwal_piket...');
      const { data: cloudPiket, error: pikErr } = await supabaseClient.from('tia_jadwal_piket').select('*');
      if (!pikErr && cloudPiket) {
        const localPiket = JSON.parse(localStorage.getItem(DB_KEYS.PIKET) || '[]');
        const pikMap = new Map(cloudPiket.map(p => [p.id, p]));
        const unsyncedPik = localPiket.filter(p => p._unsynced);
        for (const p of unsyncedPik) {
          try {
            const clean = { ...p }; delete clean._unsynced;
            const { error } = await supabaseClient.from('tia_jadwal_piket').upsert([clean]);
            if (!error) { delete p._unsynced; pikMap.set(p.id, clean); }
          } catch(e) { pikMap.set(p.id, p); }
        }
        this.cache.piket = Array.from(pikMap.values());
      } else {
        if (pikErr) console.warn('[SYNC] ⚠️ Step 12 (piket):', pikErr.message);
        this.cache.piket = JSON.parse(localStorage.getItem(DB_KEYS.PIKET) || '[]');
      }

      // 13. Sync Izin Staf
      console.log('[SYNC] Step 13: tia_izin_staf...');
      const { data: cloudIzin, error: iznErr } = await supabaseClient.from('tia_izin_staf').select('*');
      if (!iznErr && cloudIzin) {
        const localIzin = JSON.parse(localStorage.getItem(DB_KEYS.IZIN) || '[]');
        const iznMap = new Map(cloudIzin.map(i => [i.id, i]));
        const unsyncedIzin = localIzin.filter(i => i._unsynced);
        for (const i of unsyncedIzin) {
          try {
            const clean = { ...i }; delete clean._unsynced;
            const { error } = await supabaseClient.from('tia_izin_staf').upsert([clean]);
            if (!error) { delete i._unsynced; iznMap.set(i.id, clean); }
          } catch(e) { iznMap.set(i.id, i); }
        }
        this.cache.izin = Array.from(iznMap.values());
      } else {
        if (iznErr) console.warn('[SYNC] ⚠️ Step 13 (izin):', iznErr.message);
        this.cache.izin = JSON.parse(localStorage.getItem(DB_KEYS.IZIN) || '[]');
      }

      // 14. Sync Jadwal Shift
      console.log('[SYNC] Step 14: tia_jadwal_shift...');
      const { data: cloudShift, error: shiftErr } = await supabaseClient.from('tia_jadwal_shift').select('*');
      if (!shiftErr && cloudShift) {
        const localShift = JSON.parse(localStorage.getItem(DB_KEYS.SHIFT) || '[]');
        const shiftMap = new Map(cloudShift.map(s => [s.id, s]));
        const unsyncedShift = localShift.filter(s => s._unsynced);
        for (const s of unsyncedShift) {
          try {
            const clean = { ...s }; delete clean._unsynced;
            const { error } = await supabaseClient.from('tia_jadwal_shift').upsert([clean]);
            if (!error) { delete s._unsynced; shiftMap.set(s.id, clean); }
          } catch(e) { shiftMap.set(s.id, s); }
        }
        this.cache.shift = Array.from(shiftMap.values());
      } else {
        if (shiftErr) console.warn('[SYNC] ⚠️ Step 14 (shift):', shiftErr.message);
        this.cache.shift = JSON.parse(localStorage.getItem(DB_KEYS.SHIFT) || '[]');
      }

      // Update backup local storage
      localStorage.setItem(DB_KEYS.STAFF,           JSON.stringify(this.cache.staff));
      localStorage.setItem(DB_KEYS.LOGS,            JSON.stringify(this.cache.logs));
      localStorage.setItem(DB_KEYS.CHECKLIST,       JSON.stringify(this.cache.checklists));
      localStorage.setItem(DB_KEYS.SISWA,           JSON.stringify(this.cache.siswa));
      localStorage.setItem(DB_KEYS.MENTOR_ASSIGN,   JSON.stringify(this.cache.mentorAssigns));
      localStorage.setItem(DB_KEYS.ABSEN_MENTORING, JSON.stringify(this.cache.absenMentoring));
      localStorage.setItem(DB_KEYS.STAFF_KELAS,     JSON.stringify(this.cache.staffKelas));
      localStorage.setItem(DB_KEYS.SISWA_KELAS,     JSON.stringify(this.cache.siswaKelas));
      localStorage.setItem(DB_KEYS.ABSEN_CONFIG,    JSON.stringify(this.cache.absenConfig));
      localStorage.setItem(DB_KEYS.PENGUMUMAN,      JSON.stringify(this.cache.pengumuman));
      localStorage.setItem(DB_KEYS.PENILAIAN,       JSON.stringify(this.cache.penilaian));
      localStorage.setItem(DB_KEYS.PIKET,           JSON.stringify(this.cache.piket));
      localStorage.setItem(DB_KEYS.IZIN,            JSON.stringify(this.cache.izin));
      localStorage.setItem(DB_KEYS.SHIFT,           JSON.stringify(this.cache.shift));

      console.log("Database Supabase berhasil disinkronisasi!");
      return true; // Successfully synced
    } catch (err) {
      console.error("[SYNC] ❌ SYNC GAGAL TOTAL:", err?.message || err?.code || err);
      console.error("[SYNC] Detail:", JSON.stringify(err, null, 2));
      this._lastSyncError = err?.message || err?.code || 'Unknown error';
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
        const { error } = await supabaseClient.from('tia_master_staff').insert([staff]);
        if (error) throw error;
      } catch (err) {
        console.error("Cloud insert staff failed:", err);
        staff._unsynced = true;
        localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));
      }
    } else {
      staff._unsynced = true;
      localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(this.cache.staff));
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
        const { error } = await supabaseClient.from('tia_master_staff').update(updates).eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error("Cloud update staff failed:", err);
        list[i]._unsynced = true;
        localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(list));
      }
    } else {
      list[i]._unsynced = true;
      localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(list));
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
        const { error } = await supabaseClient.from('tia_siswa_aktif').insert([siswa]);
        if (error) throw error;
      } catch (err) {
        console.error('Cloud insert siswa failed:', err);
        siswa._unsynced = true;
        localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(this.cache.siswa));
      }
    } else {
      siswa._unsynced = true;
      localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(this.cache.siswa));
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
        const { error } = await supabaseClient.from('tia_siswa_aktif').update(updates).eq('nim', nim);
        if (error) throw error;
      } catch (err) {
        console.error('Cloud update siswa failed:', err);
        list[i]._unsynced = true;
        localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(list));
      }
    } else {
      list[i]._unsynced = true;
      localStorage.setItem(DB_KEYS.SISWA, JSON.stringify(list));
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
    let hasError = false;
    if (supabaseClient) {
      try {
        // Hapus assign lama di cloud
        const { error: delErr } = await supabaseClient.from('tia_mentor_assign').delete().eq('staff_id', staffId);
        if (delErr) throw delErr;
        // Insert baru jika ada
        if (nimArray.length > 0) {
          const toInsert = nimArray.map(nim => ({
            id:       `MA_${staffId}_${nim}`,
            staff_id: staffId,
            siswa_nim: nim
          }));
          const { error: insErr } = await supabaseClient.from('tia_mentor_assign').insert(toInsert);
          if (insErr) throw insErr;
        }
      } catch (err) {
        console.error('Cloud set mentor assign failed:', err);
        hasError = true;
      }
    } else {
      hasError = true;
    }

    const newAssigns = nimArray.map(nim => ({
      id:       `MA_${staffId}_${nim}`,
      staff_id: staffId,
      siswa_nim: nim,
      ...(hasError ? { _unsynced: true } : {})
    }));
    this.cache.mentorAssigns.push(...newAssigns);
    localStorage.setItem(DB_KEYS.MENTOR_ASSIGN, JSON.stringify(this.cache.mentorAssigns));
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

  // ── ABSEN CONFIG ─────────────────────────────────────

  getAbsenConfig(kelasId, sesi) {
    if (!kelasId) return ABSEN_SESI[sesi];
    const conf = this.cache.absenConfig.find(c => c.kelas_id === kelasId);
    if (!conf) return ABSEN_SESI[sesi];
    if (sesi === 'pagi') {
      return { jam: conf.pagi_jam || ABSEN_SESI.pagi.jam, windowStart: conf.pagi_start || ABSEN_SESI.pagi.windowStart, windowEnd: conf.pagi_end || ABSEN_SESI.pagi.windowEnd, label: 'Pagi' };
    } else if (sesi === 'malam') {
      return { jam: conf.malam_jam || ABSEN_SESI.malam.jam, windowStart: conf.malam_start || ABSEN_SESI.malam.windowStart, windowEnd: conf.malam_end || ABSEN_SESI.malam.windowEnd, label: 'Malam' };
    } else if (sesi === 'sabtu') {
      return { jam: conf.sabtu_jam || ABSEN_SESI.sabtu.jam, windowStart: conf.sabtu_start || ABSEN_SESI.sabtu.windowStart, windowEnd: conf.sabtu_end || ABSEN_SESI.sabtu.windowEnd, label: 'Sabtu Pagi' };
    }
  },

  async updateAbsenConfig(kelasId, payload) {
    const list = this.cache.absenConfig;
    let i = list.findIndex(c => c.kelas_id === kelasId);
    if (i === -1) {
      list.push({ kelas_id: kelasId, ...payload });
      i = list.length - 1;
    } else {
      list[i] = { ...list[i], ...payload };
    }
    localStorage.setItem(DB_KEYS.ABSEN_CONFIG, JSON.stringify(list));
    
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tia_absen_config').upsert([list[i]]);
        if (error) throw error;
        delete list[i]._unsynced;
        localStorage.setItem(DB_KEYS.ABSEN_CONFIG, JSON.stringify(list));
      } catch (err) {
        list[i]._unsynced = true;
        localStorage.setItem(DB_KEYS.ABSEN_CONFIG, JSON.stringify(list));
      }
    } else {
      list[i]._unsynced = true;
      localStorage.setItem(DB_KEYS.ABSEN_CONFIG, JSON.stringify(list));
    }
  },

  // ── PENGUMUMAN CRUD ───────────────────────────────────

  getPengumuman() {
    const now = new Date().toISOString();
    return this.cache.pengumuman
      .filter(p => !p.expired_at || p.expired_at >= now)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getPengumumanAll() {
    return [...this.cache.pengumuman].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async addPengumuman({ judul, isi, tipe, dibuat_oleh, expired_at }) {
    const rec = {
      id: 'PNG' + Date.now(),
      judul, isi, tipe: tipe || 'info', dibuat_oleh,
      created_at: new Date().toISOString(),
      expired_at: expired_at || null,
      _unsynced: true
    };
    this.cache.pengumuman.unshift(rec);
    localStorage.setItem(DB_KEYS.PENGUMUMAN, JSON.stringify(this.cache.pengumuman));
    if (supabaseClient) {
      try {
        const clean = { ...rec }; delete clean._unsynced;
        await supabaseClient.from('tia_pengumuman').insert([clean]);
        delete rec._unsynced;
        localStorage.setItem(DB_KEYS.PENGUMUMAN, JSON.stringify(this.cache.pengumuman));
      } catch(e) { console.warn('Cloud pengumuman failed:', e); }
    }
    return rec;
  },

  async deletePengumuman(id) {
    this.cache.pengumuman = this.cache.pengumuman.filter(p => p.id !== id);
    localStorage.setItem(DB_KEYS.PENGUMUMAN, JSON.stringify(this.cache.pengumuman));
    if (supabaseClient) {
      try { await supabaseClient.from('tia_pengumuman').delete().eq('id', id); } catch(e) {}
    }
  },

  // ── PENILAIAN STAF CRUD ───────────────────────────────

  getPenilaian(filter = {}) {
    let arr = [...this.cache.penilaian];
    if (filter.staffId) arr = arr.filter(p => p.staff_id === filter.staffId);
    if (filter.tanggal) arr = arr.filter(p => p.tanggal === filter.tanggal);
    return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getPenilaianStafHari(staffId, tanggal) {
    return this.cache.penilaian.find(p => p.staff_id === staffId && p.tanggal === tanggal) || null;
  },

  async addPenilaian({ staff_id, staff_nama, tanggal, nilai, komentar }) {
    // Hapus penilaian lama untuk staf+hari yang sama (upsert)
    this.cache.penilaian = this.cache.penilaian.filter(p => !(p.staff_id === staff_id && p.tanggal === tanggal));
    const rec = {
      id: 'PEN' + Date.now(),
      staff_id, staff_nama, tanggal,
      nilai: parseInt(nilai), komentar: komentar || '',
      created_at: new Date().toISOString(),
      _unsynced: true
    };
    this.cache.penilaian.push(rec);
    localStorage.setItem(DB_KEYS.PENILAIAN, JSON.stringify(this.cache.penilaian));
    if (supabaseClient) {
      try {
        // Hapus record lama di cloud juga
        await supabaseClient.from('tia_penilaian_staf').delete().eq('staff_id', staff_id).eq('tanggal', tanggal);
        const clean = { ...rec }; delete clean._unsynced;
        await supabaseClient.from('tia_penilaian_staf').insert([clean]);
        delete rec._unsynced;
        localStorage.setItem(DB_KEYS.PENILAIAN, JSON.stringify(this.cache.penilaian));
      } catch(e) { console.warn('Cloud penilaian failed:', e); }
    }
    return rec;
  },

  // ── JADWAL PIKET CRUD ─────────────────────────────────

  getPiket(filter = {}) {
    let arr = [...this.cache.piket];
    if (filter.staffId)  arr = arr.filter(p => p.staff_id === filter.staffId);
    if (filter.tanggal)  arr = arr.filter(p => p.tanggal === filter.tanggal);
    if (filter.mingguOf) {
      // Ambil tanggal-tanggal satu minggu (Senin–Minggu) dari tanggal acuan
      const ref = new Date(filter.mingguOf + 'T00:00:00');
      const day = ref.getDay(); // 0=Sun
      const monday = new Date(ref); monday.setDate(ref.getDate() - (day === 0 ? 6 : day - 1));
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      arr = arr.filter(p => dates.includes(p.tanggal));
    }
    return arr.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  },

  async addPiket({ staff_id, staff_nama, tanggal, area, catatan }) {
    const rec = {
      id: 'PIK' + Date.now(),
      staff_id, staff_nama, tanggal, area, catatan: catatan || '',
      created_at: new Date().toISOString(),
      _unsynced: true
    };
    this.cache.piket.push(rec);
    localStorage.setItem(DB_KEYS.PIKET, JSON.stringify(this.cache.piket));
    if (supabaseClient) {
      try {
        const clean = { ...rec }; delete clean._unsynced;
        await supabaseClient.from('tia_jadwal_piket').insert([clean]);
        delete rec._unsynced;
        localStorage.setItem(DB_KEYS.PIKET, JSON.stringify(this.cache.piket));
      } catch(e) { console.warn('Cloud piket failed:', e); }
    }
    return rec;
  },

  async deletePiket(id) {
    this.cache.piket = this.cache.piket.filter(p => p.id !== id);
    localStorage.setItem(DB_KEYS.PIKET, JSON.stringify(this.cache.piket));
    if (supabaseClient) {
      try { await supabaseClient.from('tia_jadwal_piket').delete().eq('id', id); } catch(e) {}
    }
  },

  // ── IZIN / CUTI CRUD ─────────────────────────────────

  getIzin(filter = {}) {
    let arr = [...this.cache.izin];
    if (filter.staffId) arr = arr.filter(i => i.staff_id === filter.staffId);
    if (filter.status)  arr = arr.filter(i => i.status === filter.status);
    return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async addIzin({ staff_id, staff_nama, jenis, tgl_mulai, tgl_selesai, alasan }) {
    const rec = {
      id: 'IZN' + Date.now(),
      staff_id, staff_nama, jenis, tgl_mulai, tgl_selesai, alasan,
      status: 'Menunggu', komentar_admin: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _unsynced: true
    };
    this.cache.izin.unshift(rec);
    localStorage.setItem(DB_KEYS.IZIN, JSON.stringify(this.cache.izin));
    if (supabaseClient) {
      try {
        const clean = { ...rec }; delete clean._unsynced;
        await supabaseClient.from('tia_izin_staf').insert([clean]);
        delete rec._unsynced;
        localStorage.setItem(DB_KEYS.IZIN, JSON.stringify(this.cache.izin));
      } catch(e) { console.warn('Cloud izin failed:', e); }
    }
    return rec;
  },

  async updateIzinStatus(id, status, komentar_admin) {
    const rec = this.cache.izin.find(i => i.id === id);
    if (!rec) return;
    rec.status = status;
    rec.komentar_admin = komentar_admin || '';
    rec.updated_at = new Date().toISOString();
    rec._unsynced = true;
    localStorage.setItem(DB_KEYS.IZIN, JSON.stringify(this.cache.izin));
    if (supabaseClient) {
      try {
        await supabaseClient.from('tia_izin_staf').update({
          status, komentar_admin: komentar_admin || '', updated_at: rec.updated_at
        }).eq('id', id);
        delete rec._unsynced;
        localStorage.setItem(DB_KEYS.IZIN, JSON.stringify(this.cache.izin));
      } catch(e) { console.warn('Cloud izin update failed:', e); }
    }
    return rec;
  },

  // ── JADWAL SHIFT CRUD ─────────────────────────────

  /** Ambil semua jadwal shift. Filter opsional: tanggal. */
  getShift(filter = {}) {
    let arr = [...this.cache.shift];
    if (filter.tanggal) arr = arr.filter(s => s.tanggal === filter.tanggal);
    return arr.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  },

  /** Ambil jadwal shift staf untuk hari ini. Return: 'pagi' | 'siang' | null */
  getShiftStaffToday(staffId) {
    const today = this.today();
    const rec = this.cache.shift.find(s => s.tanggal === today);
    if (!rec) return null;
    if ((rec.staff_pagi  || []).includes(staffId)) return 'pagi';
    if ((rec.staff_siang || []).includes(staffId)) return 'siang';
    return null;
  },

  /** Ambil jadwal shift staf untuk tanggal tertentu. Return: 'pagi' | 'siang' | null */
  getShiftStaffByDate(staffId, tanggal) {
    const rec = this.cache.shift.find(s => s.tanggal === tanggal);
    if (!rec) return null;
    if ((rec.staff_pagi  || []).includes(staffId)) return 'pagi';
    if ((rec.staff_siang || []).includes(staffId)) return 'siang';
    return null;
  },

  /** Ambil record shift untuk tanggal tertentu. */
  getShiftByTanggal(tanggal) {
    return this.cache.shift.find(s => s.tanggal === tanggal) || null;
  },

  /**
   * Simpan/replace jadwal shift untuk satu tanggal.
   * staff_pagi: array staffId (max 2), staff_siang: array staffId (max 2)
   */
  async setShift({ tanggal, staff_pagi, staff_siang, dibuat_oleh }) {
    const id = `SHF_${tanggal}`;
    const existing = this.cache.shift.findIndex(s => s.tanggal === tanggal);
    const rec = {
      id,
      tanggal,
      staff_pagi:  staff_pagi  || [],
      staff_siang: staff_siang || [],
      dibuat_oleh: dibuat_oleh || 'ADMIN',
      created_at:  new Date().toISOString()
    };
    if (existing !== -1) {
      this.cache.shift[existing] = rec;
    } else {
      this.cache.shift.push(rec);
    }
    localStorage.setItem(DB_KEYS.SHIFT, JSON.stringify(this.cache.shift));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tia_jadwal_shift').upsert([rec]);
        if (error) throw error;
        localStorage.setItem(DB_KEYS.SHIFT, JSON.stringify(this.cache.shift));
      } catch(e) {
        console.warn('Cloud shift save failed:', e);
        rec._unsynced = true;
        localStorage.setItem(DB_KEYS.SHIFT, JSON.stringify(this.cache.shift));
      }
    } else {
      rec._unsynced = true;
      localStorage.setItem(DB_KEYS.SHIFT, JSON.stringify(this.cache.shift));
    }
    return rec;
  },

  async deleteShift(tanggal) {
    this.cache.shift = this.cache.shift.filter(s => s.tanggal !== tanggal);
    localStorage.setItem(DB_KEYS.SHIFT, JSON.stringify(this.cache.shift));
    if (supabaseClient) {
      try { await supabaseClient.from('tia_jadwal_shift').delete().eq('tanggal', tanggal); } catch(e) {}
    }
  },

  /**
   * Deteksi shift aktif staf berdasarkan jam sekarang.
   * Return: { shift: 'pagi'|'siang'|null, isActive: boolean, label: string }
   */
  detectCurrentShift(staffId) {
    const shiftType = this.getShiftStaffToday(staffId);
    if (!shiftType) return { shift: null, isActive: false, label: null };

    const now = this.nowHHMM();
    const ranges = {
      pagi:  { start: '10:00', end: '13:00' },
      siang: { start: '13:00', end: '16:00' }
    };
    const range = ranges[shiftType];
    const isActive = now >= range.start && now < range.end;
    return { shift: shiftType, isActive, label: shiftType === 'pagi' ? 'Shift Pagi' : 'Shift Siang' };
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

'use strict';

/* ============================================================
 * Dagangku — pencatatan modal & untung untuk pedagang makanan.
 * Semua data disimpan di HP pengguna (localStorage), tanpa server.
 * ============================================================ */

const STORAGE_KEY = 'dagangku-v1';

// Satuan beli dan satuan kecil yang dipakai saat menyusun resep.
const SATUAN = {
  kg: { kecil: 'gram', faktor: 1000 },
  liter: { kecil: 'ml', faktor: 1000 },
  pcs: { kecil: 'pcs', faktor: 1 },
  ikat: { kecil: 'ikat', faktor: 1 },
  bungkus: { kecil: 'bungkus', faktor: 1 },
};

function defaultState() {
  return { versi: 1, namaUsaha: '', bahan: [], belanja: [], menu: [], jualan: [], koreksi: [], rencana: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* data rusak atau storage diblokir: mulai kosong */ }
  return defaultState();
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    toast('Gagal menyimpan. Memori HP mungkin penuh.');
    return false;
  }
}

// Minta browser tidak menghapus data saat memori HP menipis.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Utilitas ---------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function today() {
  const d = new Date();
  return toISO(d);
}
function toISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function fmtTanggal(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

const rpFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const rp = (n) => (n < 0 ? '-Rp' : 'Rp') + rpFmt.format(Math.abs(Math.round(n || 0)));
const angka = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0);

function num(v) {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
// Input harga boleh ditulis "15.000"; input jumlah boleh "0,5".
function numJumlah(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const bulatAtas500 = (n) => Math.ceil(n / 500) * 500;
const bulatBawah500 = (n) => Math.floor(n / 500) * 500;

// Kotak dialog sendiri, pengganti confirm()/prompt() bawaan browser.
// Hasil: false/null kalau batal, true (atau isi teks) kalau setuju.
function tanya({ pesan, ok = 'Ya', bahaya = false, input = null }) {
  return new Promise((selesai) => {
    const el = document.createElement('div');
    el.className = 'dialog-bg';
    el.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">
      <p>${esc(pesan).replace(/\n/g, '<br>')}</p>
      ${input !== null ? `<input id="dialog-input" inputmode="decimal" value="${esc(input)}">` : ''}
      <div class="row" style="margin-top:14px">
        <button class="btn" data-jawab="batal">Batal</button>
        <button class="btn ${bahaya ? 'danger' : 'primary'}" data-jawab="ok">${esc(ok)}</button>
      </div></div>`;
    document.body.appendChild(el);
    const field = el.querySelector('#dialog-input');
    (field || el.querySelector('[data-jawab="ok"]')).focus();
    const tutup = (setuju) => {
      el.remove();
      selesai(setuju ? (field ? field.value : true) : (field ? null : false));
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-jawab]');
      if (b) tutup(b.dataset.jawab === 'ok');
      else if (e.target === el) tutup(false);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tutup(true);
      if (e.key === 'Escape') tutup(false);
    });
  });
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ---------- Perhitungan ---------- */

const cariBahan = (id) => state.bahan.find((b) => b.id === id);
const cariMenu = (id) => state.menu.find((m) => m.id === id);

// Pemakaian bahan per porsi, dalam satuan beli (mis. kg).
function pemakaianPerPorsi(menu) {
  return (menu.komposisi || [])
    .map((k) => {
      const b = cariBahan(k.bahanId);
      if (!b) return null;
      return { bahanId: b.id, jumlah: k.jumlah / SATUAN[b.satuan].faktor };
    })
    .filter(Boolean);
}

// Modal (HPP) satu porsi = biaya bahan sesuai resep + biaya lain per porsi.
function hppMenu(menu) {
  const bahan = pemakaianPerPorsi(menu).reduce((t, p) => t + p.jumlah * (cariBahan(p.bahanId).harga || 0), 0);
  return bahan + num(menu.biayaLain);
}

function saranHarga(menu) {
  const hpp = hppMenu(menu);
  const target = menu.targetPersen > 0 ? menu.targetPersen : 40;
  const hargaAman = bulatAtas500(hpp * (1 + target / 100));
  const jual = num(menu.hargaJual);
  const pasar = num(menu.hargaPasar);
  const hasil = { hpp, target, hargaAman, untung: jual - hpp, persen: jual > 0 ? ((jual - hpp) / jual) * 100 : 0 };

  if (jual > 0 && jual < hpp) {
    hasil.level = 'bad';
    hasil.pesan = `Rugi ${rp(hpp - jual)} setiap porsi! Harga jual di bawah modal. Minimal jual ${rp(hargaAman)}.`;
  } else if (pasar > 0 && hargaAman > pasar) {
    hasil.level = 'warn';
    hasil.pesan = `Modalmu tinggi: harga aman ${rp(hargaAman)} di atas harga pasaran ${rp(pasar)}. Coba cari bahan lebih murah atau atur ulang porsi.`;
  } else if (pasar > 0) {
    // Ada ruang antara harga aman dan harga pasaran: sarankan sedikit di bawah pasar agar tetap bersaing.
    const saran = Math.max(hargaAman, bulatBawah500(pasar * 0.95));
    hasil.saran = saran;
    if (jual > 0 && jual < saran) {
      hasil.level = 'good';
      hasil.pesan = `Hargamu masih di bawah pasaran (${rp(pasar)}). Bisa naik ke sekitar ${rp(saran)}: untung bertambah ${rp(saran - jual)} per porsi dan tetap bersaing.`;
    } else {
      hasil.level = 'good';
      hasil.pesan = `Harga sudah pas. Harga aman ${rp(hargaAman)}, pasaran ${rp(pasar)}.`;
    }
  } else {
    hasil.level = jual >= hargaAman ? 'good' : 'warn';
    hasil.pesan = jual >= hargaAman
      ? `Untung ${angka(hasil.persen)}% per porsi. Isi harga pasaran untuk dapat saran harga.`
      : `Untung masih tipis. Dengan target untung ${target}%, harga aman ${rp(hargaAman)}.`;
  }
  return hasil;
}

// Perkiraan stok = total dibeli − dipakai untuk porsi yang dibuat + koreksi manual.
function stokBahan(bahanId) {
  let stok = 0;
  for (const b of state.belanja) if (b.bahanId === bahanId) stok += b.jumlah;
  for (const j of state.jualan) {
    for (const p of j.pemakaian || []) if (p.bahanId === bahanId) stok -= p.jumlah * j.dibuat;
  }
  for (const k of state.koreksi) if (k.bahanId === bahanId) stok += k.selisih;
  return stok;
}

function ringkasan(dari, sampai) {
  const inRange = (t) => t >= dari && t <= sampai;
  const r = { belanja: 0, penjualan: 0, hppTerjual: 0, dibuat: 0, terjual: 0, sisa: 0, nilaiSisa: 0, susut: 0, perMenu: {}, perHari: {} };

  for (const b of state.belanja) if (inRange(b.tanggal)) r.belanja += b.totalHarga;

  for (const j of state.jualan) {
    if (!inRange(j.tanggal)) continue;
    const sisa = j.dibuat - j.terjual;
    const omzet = j.terjual * j.hargaJual;
    const modal = j.terjual * j.hpp;
    r.penjualan += omzet;
    r.hppTerjual += modal;
    r.dibuat += j.dibuat;
    r.terjual += j.terjual;
    r.sisa += sisa;
    r.nilaiSisa += sisa * j.hpp;

    const m = (r.perMenu[j.menuId] ||= { nama: j.namaMenu, terjual: 0, penjualan: 0, untung: 0, sisa: 0 });
    m.terjual += j.terjual;
    m.penjualan += omzet;
    m.untung += omzet - modal;
    m.sisa += sisa;

    const h = (r.perHari[j.tanggal] ||= { penjualan: 0, untung: 0 });
    h.penjualan += omzet;
    h.untung += omzet - modal;
  }

  for (const k of state.koreksi) if (inRange(k.tanggal) && k.selisih < 0) r.susut += -k.selisih * k.harga;

  r.untungKotor = r.penjualan - r.hppTerjual;
  r.untungSetelahSisa = r.untungKotor - r.nilaiSisa;
  r.arusKas = r.penjualan - r.belanja;
  return r;
}

/* ---------- Tampilan ---------- */

const $app = document.getElementById('app');
let view = 'beranda';
const ui = { jualanTanggal: today(), periode: '7', draftMenu: null, bahanBaru: false, tabBelanja: 'daftar' };

function go(v) {
  view = v;
  if (v !== 'menu') ui.draftMenu = null;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const views = { beranda: viewBeranda, belanja: viewBelanja, menu: viewMenu, jualan: viewJualan, laporan: viewLaporan, pengaturan: viewPengaturan };
  $app.innerHTML = views[view]();
  document.getElementById('nama-usaha').textContent = state.namaUsaha;
  document.querySelectorAll('.bottomnav [data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
}

function stat(label, nilai, cls = '', wide = false) {
  return `<div class="stat${wide ? ' wide' : ''}"><small>${label}</small><strong class="${cls}">${nilai}</strong></div>`;
}
const tanda = (n) => (n >= 0 ? 'pos' : 'neg');

function viewBeranda() {
  const t = today();
  const r = ringkasan(t, t);
  const kosong = state.bahan.length === 0 && state.menu.length === 0;

  let html = `<h1>Halo${state.namaUsaha ? ', ' + esc(state.namaUsaha) : ''} 👋</h1>`;

  if (kosong) {
    html += `<div class="card">
      <h2 style="margin-top:0">Mulai dalam 3 langkah</h2>
      <ol class="steps">
        <li><b>Belanja</b>: catat bahan yang dibeli dan harganya.</li>
        <li><b>Menu</b>: tulis resep per porsi. Modal per porsi dihitung otomatis.</li>
        <li><b>Jualan</b>: tiap tutup lapak, catat porsi dibuat dan terjual.</li>
      </ol>
      <button class="btn primary block" data-nav="belanja">Catat belanja pertama</button>
      <button class="btn block" data-action="contoh">Coba dengan contoh data (bakso &amp; ayam geprek)</button>
    </div>`;
    return html;
  }

  html += `<p class="muted">Hari ini, ${fmtTanggal(t)}</p>
    <div class="stats">
      ${stat('Penjualan', rp(r.penjualan))}
      ${stat('Untung kotor', rp(r.untungKotor), tanda(r.untungKotor))}
      ${stat('Belanja bahan', rp(r.belanja))}
      ${stat('Porsi terjual / sisa', `${angka(r.terjual)} / ${angka(r.sisa)}`)}
    </div>`;

  if (!state.jualan.some((j) => j.tanggal === t)) {
    html += `<button class="btn primary block" data-nav="jualan">Catat jualan hari ini</button>`;
  }

  const peringatan = [];
  for (const m of state.menu) {
    const s = saranHarga(m);
    if (s.level === 'bad') peringatan.push(`<div class="alert bad"><b>${esc(m.nama)}</b>: ${s.pesan}</div>`);
    else if (s.saran && num(m.hargaJual) < s.saran) peringatan.push(`<div class="alert good"><b>${esc(m.nama)}</b>: ${s.pesan}</div>`);
  }
  const habis = state.bahan.filter((b) => stokBahan(b.id) <= 0).map((b) => esc(b.nama));
  if (habis.length) {
    peringatan.push(`<div class="alert warn">Stok diperkirakan habis: <b>${habis.join(', ')}</b>. Catat belanja baru, atau sesuaikan stok di halaman Belanja.</div>`);
  }
  if (peringatan.length) html += `<h2>Perlu perhatian</h2>${peringatan.join('')}`;

  return html;
}

// Pilih bahan yang sudah ada, atau tekan tombol "+ Bahan baru" untuk mengetik bahan baru.
// Kolom yang disembunyikan ikut dinonaktifkan supaya tidak terkirim bersama form.
function fieldBahan(prefix, opsiBahan, opsiSatuan) {
  const adaBahan = state.bahan.length > 0;
  const baru = ui.bahanBaru || !adaBahan;
  return `<div data-pilih-bahan>
    <div data-mode="lama" class="${baru ? 'hidden' : ''}">
      <label for="${prefix}-bahan">Bahan</label>
      <select id="${prefix}-bahan" name="bahanId" ${baru ? 'disabled' : ''}>${opsiBahan}</select>
      <button type="button" class="btn small" data-action="bahan-baru" style="margin-top:8px">+ Bahan baru</button>
    </div>
    <div data-mode="baru" class="${baru ? '' : 'hidden'}">
      <input type="hidden" name="bahanId" value="__baru" ${baru ? '' : 'disabled'}>
      <div class="row">
        <div><label for="${prefix}-nama">Nama bahan baru</label><input id="${prefix}-nama" name="nama" placeholder="mis. Daging sapi" ${baru ? '' : 'disabled'}></div>
        <div class="shrink" style="width:130px"><label for="${prefix}-satuan">Satuan</label><select id="${prefix}-satuan" name="satuan" ${baru ? '' : 'disabled'}>${opsiSatuan}</select></div>
      </div>
      ${adaBahan ? `<button type="button" class="btn small" data-action="bahan-lama" style="margin-top:8px">← Pilih bahan yang sudah ada</button>` : ''}
    </div>
  </div>`;
}

function setModeBahan(el, baru) {
  ui.bahanBaru = baru;
  const box = el.closest('[data-pilih-bahan]');
  for (const mode of box.querySelectorAll('[data-mode]')) {
    const tampil = (mode.dataset.mode === 'baru') === baru;
    mode.classList.toggle('hidden', !tampil);
    mode.querySelectorAll('input, select').forEach((f) => { f.disabled = !tampil; });
  }
  if (baru) box.querySelector('[name="nama"]').focus();
  hargaSatuanPreview();
}

function viewBelanja() {
  const opsiBahan = state.bahan.map((b) => `<option value="${b.id}">${esc(b.nama)} (${b.satuan})</option>`).join('');
  const opsiSatuan = Object.keys(SATUAN).map((s) => `<option value="${s}">${s}</option>`).join('');

  const tab = (v, l) => `<button class="chip ${ui.tabBelanja === v ? 'active' : ''}" data-action="tab-belanja" data-v="${v}">${l}</button>`;
  let html = `<h1>Belanja bahan</h1>
  <div class="chips">${tab('daftar', 'Daftar belanja')}${tab('catat', 'Catat langsung')}</div>`;

  if (ui.tabBelanja === 'daftar') html += viewDaftarBelanja(opsiBahan, opsiSatuan);
  else html += `
  <form class="card" data-form="belanja">
    <label for="b-tgl">Tanggal</label>
    <input id="b-tgl" name="tanggal" type="date" value="${today()}" required>
    ${fieldBahan('b', opsiBahan, opsiSatuan)}
    <div class="row">
      <div><label for="b-jml">Jumlah</label><input id="b-jml" name="jumlah" inputmode="decimal" placeholder="mis. 2" required></div>
      <div><label for="b-harga">Total bayar (Rp)</label><input id="b-harga" name="totalHarga" inputmode="numeric" placeholder="mis. 260000" required></div>
    </div>
    <p class="muted" id="harga-satuan">&nbsp;</p>
    <button class="btn primary block" type="submit">Simpan belanja</button>
  </form>`;

  if (state.bahan.length) {
    html += `<h2>Harga &amp; stok bahan</h2><div class="card"><ul class="list">` +
      state.bahan.map((b) => {
        const stok = stokBahan(b.id);
        return `<li>
          <div><b>${esc(b.nama)}</b><br><span class="muted">${rp(b.harga)}/${b.satuan}</span></div>
          <div class="right">
            <span class="${stok <= 0 ? 'neg' : ''}">Sisa ±${angka(stok)} ${b.satuan}</span><br>
            <button class="btn small" data-action="koreksi" data-id="${b.id}">Sesuaikan stok</button>
          </div></li>`;
      }).join('') + `</ul></div>`;
  }

  const terbaru = [...state.belanja].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 15);
  if (terbaru.length) {
    html += `<h2>Belanja terakhir</h2><div class="card"><ul class="list">` +
      terbaru.map((b) => {
        const bahan = cariBahan(b.bahanId);
        return `<li>
          <div>${esc(bahan ? bahan.nama : '?')} · ${angka(b.jumlah)} ${bahan ? bahan.satuan : ''}<br><span class="muted">${fmtTanggal(b.tanggal)}</span></div>
          <div class="right">${rp(b.totalHarga)}<br><button class="btn small danger" data-action="hapus-belanja" data-id="${b.id}">Hapus</button></div>
        </li>`;
      }).join('') + `</ul></div>`;
  }
  return html;
}

// Daftar belanja: disusun dulu dengan harga kosong, diisi saat di pasar.
function perkiraanRencana(item) {
  const b = item.bahanId && cariBahan(item.bahanId);
  const jumlah = numJumlah(item.jumlah);
  return b && b.harga && jumlah > 0 ? jumlah * b.harga : 0;
}

function totalRencana() {
  let perkiraan = 0;
  let dibayar = 0;
  for (const r of state.rencana) {
    perkiraan += num(r.total) > 0 ? num(r.total) : perkiraanRencana(r);
    dibayar += num(r.total);
  }
  return { perkiraan, dibayar };
}

function teksTotalRencana() {
  const t = totalRencana();
  return `Perkiraan uang dibawa: <b>${rp(t.perkiraan)}</b> · Sudah dibayar: <b>${rp(t.dibayar)}</b>`;
}

function linkDaftarWhatsApp() {
  const baris = state.rencana.map((r) => {
    const jml = numJumlah(r.jumlah) > 0 ? ` ${angka(numJumlah(r.jumlah))} ${r.satuan}` : '';
    return `☐ ${r.nama}${jml}`;
  });
  const teks = [`*Daftar belanja ${state.namaUsaha || ''}*`.replace(' *', '*'), fmtTanggal(today()), ...baris, '', `Perkiraan: ${rp(totalRencana().perkiraan)}`].join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(teks);
}

function teksPerkiraan(item) {
  const b = item.bahanId && cariBahan(item.bahanId);
  if (num(item.total) > 0 && numJumlah(item.jumlah) > 0) return `Harga jadi ${rp(num(item.total) / numJumlah(item.jumlah))}/${item.satuan}`;
  if (!b || !b.harga) return 'Belum ada harga sebelumnya';
  const p = perkiraanRencana(item);
  return p ? `Perkiraan ${rp(p)} (terakhir ${rp(b.harga)}/${b.satuan})` : `Harga terakhir ${rp(b.harga)}/${b.satuan}`;
}

function viewDaftarBelanja(opsiBahan, opsiSatuan) {
  const items = state.rencana.map((r) => {
    const b = r.bahanId && cariBahan(r.bahanId);
    return `<div class="rencana-item">
      <div class="row" style="align-items:center">
        <div><b>${esc(r.nama)}</b>${b ? ` <span class="muted">· sisa ±${angka(stokBahan(b.id))} ${r.satuan}</span>` : ''}</div>
        <button class="btn small shrink danger" data-action="hapus-rencana" data-id="${r.id}" aria-label="Hapus dari daftar">✕</button>
      </div>
      <div class="row">
        <div><label for="rj-${r.id}">Jumlah (${r.satuan})</label><input id="rj-${r.id}" inputmode="decimal" value="${esc(r.jumlah)}" placeholder="—" data-rencana="${r.id}" data-field="jumlah"></div>
        <div><label for="rt-${r.id}">Harga bayar (Rp)</label><input id="rt-${r.id}" inputmode="numeric" value="${esc(r.total)}" placeholder="belum diisi" data-rencana="${r.id}" data-field="total"></div>
        <button class="btn primary shrink" data-action="beli-rencana" data-id="${r.id}" aria-label="Simpan ke catatan belanja">✓</button>
      </div>
      <p class="muted" id="rp-${r.id}">${teksPerkiraan(r)}</p>
    </div>`;
  }).join('');

  let html = `<div class="card">
    <h2 style="margin-top:0">Daftar belanja</h2>
    <p class="muted">Susun daftar di rumah, harga dikosongkan dulu. Di pasar, isi jumlah dan harga yang dibayar, lalu tekan ✓.</p>`;

  if (items) {
    html += `${items}
    <p id="rencana-total">${teksTotalRencana()}</p>
    <button class="btn primary block" data-action="beli-semua-rencana">Simpan semua yang sudah diisi</button>
    <div class="row" style="margin-top:8px">
      <a class="btn" id="rencana-wa" href="${linkDaftarWhatsApp()}" target="_blank" rel="noopener">Kirim ke WhatsApp</a>
      <button class="btn danger" data-action="kosongkan-rencana">Kosongkan</button>
    </div>`;
  } else {
    html += `<p class="muted"><i>Daftar masih kosong.</i></p>`;
  }
  html += `</div>

  <form class="card" data-form="rencana">
    <h2 style="margin-top:0">Tambah ke daftar</h2>
    ${fieldBahan('r', opsiBahan, opsiSatuan)}
    <label for="r-jml">Jumlah (boleh dikosongkan)</label>
    <input id="r-jml" name="jumlah" inputmode="decimal" placeholder="mis. 2">
    <button class="btn primary block" type="submit">Tambah ke daftar</button>
    ${state.bahan.length ? `<button type="button" class="btn block" data-action="rencana-semua-bahan">Tambah semua bahan yang biasa dibeli</button>` : ''}
  </form>`;
  return html;
}

function beliRencana(r) {
  const jumlah = numJumlah(r.jumlah);
  const total = num(r.total);
  if (jumlah <= 0 || total <= 0) return false;
  let b = r.bahanId && cariBahan(r.bahanId);
  if (!b) {
    b = state.bahan.find((x) => x.nama.toLowerCase() === r.nama.toLowerCase() && x.satuan === r.satuan);
    if (!b) {
      b = { id: uid(), nama: r.nama, satuan: r.satuan, harga: 0 };
      state.bahan.push(b);
    }
  }
  b.harga = total / jumlah;
  state.belanja.push({ id: uid(), tanggal: today(), bahanId: b.id, jumlah, totalHarga: total });
  state.rencana = state.rencana.filter((x) => x.id !== r.id);
  return true;
}

function viewMenu() {
  if (ui.draftMenu) return viewFormMenu();

  let html = `<h1>Menu &amp; harga</h1>`;
  if (!state.bahan.length) {
    html += `<div class="alert warn">Catat belanja bahan dulu, supaya modal per porsi bisa dihitung.</div>
      <button class="btn primary block" data-nav="belanja">Ke halaman Belanja</button>`;
    return html;
  }
  html += `<button class="btn primary block" data-action="menu-baru">+ Tambah menu</button>`;

  for (const m of state.menu) {
    const s = saranHarga(m);
    html += `<div class="card">
      <div class="row" style="align-items:center"><h2 style="margin:0">${esc(m.nama)}</h2>
        <button class="btn small shrink" data-action="edit-menu" data-id="${m.id}">Ubah</button></div>
      <div class="stats" style="margin-top:10px">
        ${stat('Modal / porsi', rp(s.hpp))}
        ${stat('Harga jual', rp(m.hargaJual))}
        ${stat('Untung / porsi', rp(s.untung), tanda(s.untung))}
        ${stat('Untung (%)', angka(s.persen) + '%', tanda(s.untung))}
      </div>
      <div class="alert ${s.level}">${s.pesan}</div>
      ${s.saran && num(m.hargaJual) < s.saran ? `<button class="btn small" data-action="pakai-saran" data-id="${m.id}">Pakai harga ${rp(s.saran)}</button>` : ''}
    </div>`;
  }
  return html;
}

function viewFormMenu() {
  const d = ui.draftMenu;
  const opsi = (sel) => state.bahan.map((b) => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.nama)}</option>`).join('');
  const baris = d.komposisi.map((k, i) => {
    const b = cariBahan(k.bahanId) || state.bahan[0];
    return `<div class="row">
      <div><label for="k-b-${i}">Bahan</label><select id="k-b-${i}" name="k_bahan_${i}" data-change="sync-menu">${opsi(b.id)}</select></div>
      <div class="shrink" style="width:110px"><label for="k-j-${i}">Jumlah (${SATUAN[b.satuan].kecil})</label><input id="k-j-${i}" name="k_jumlah_${i}" inputmode="decimal" value="${k.jumlah || ''}"></div>
      <button type="button" class="btn small shrink danger" data-action="hapus-komposisi" data-i="${i}" aria-label="Hapus bahan">✕</button>
    </div>`;
  }).join('');
  const s = saranHarga(d);

  return `<h1>${d.id ? 'Ubah menu' : 'Menu baru'}</h1>
  <form class="card" data-form="menu">
    <label for="m-nama">Nama menu</label>
    <input id="m-nama" name="nama" value="${esc(d.nama)}" placeholder="mis. Bakso komplit" required>
    <h2>Resep 1 porsi</h2>
    ${baris || '<p class="muted">Belum ada bahan.</p>'}
    <button type="button" class="btn small" data-action="tambah-komposisi" style="margin-top:10px">+ Tambah bahan</button>
    <label for="m-lain">Biaya lain per porsi (gas, kemasan, sambal) Rp</label>
    <input id="m-lain" name="biayaLain" inputmode="numeric" value="${d.biayaLain || ''}" placeholder="mis. 1000">
    <div class="row">
      <div><label for="m-jual">Harga jual (Rp)</label><input id="m-jual" name="hargaJual" inputmode="numeric" value="${d.hargaJual || ''}" required></div>
      <div><label for="m-pasar">Harga pasaran (Rp)</label><input id="m-pasar" name="hargaPasar" inputmode="numeric" value="${d.hargaPasar || ''}" placeholder="pedagang lain"></div>
    </div>
    <label for="m-target">Target untung (%)</label>
    <input id="m-target" name="targetPersen" inputmode="numeric" value="${d.targetPersen || 40}">
    <div class="card" style="margin-top:14px;background:var(--surface-2)">
      <b>Modal per porsi: ${rp(s.hpp)}</b> · Harga aman: ${rp(s.hargaAman)}
      <div class="alert ${s.level}">${s.pesan}</div>
      <button type="button" class="btn small" data-action="hitung-menu">Hitung ulang</button>
    </div>
    <button class="btn primary block" type="submit">Simpan menu</button>
    <div class="row" style="margin-top:8px">
      <button type="button" class="btn" data-action="batal-menu">Batal</button>
      ${d.id ? `<button type="button" class="btn danger" data-action="hapus-menu" data-id="${d.id}">Hapus menu</button>` : ''}
    </div>
  </form>`;
}

function viewJualan() {
  if (!state.menu.length) {
    return `<h1>Catat jualan</h1><div class="alert warn">Buat menu dulu supaya bisa mencatat jualan.</div>
      <button class="btn primary block" data-nav="menu">Ke halaman Menu</button>`;
  }
  const t = ui.jualanTanggal;
  const catatan = Object.fromEntries(state.jualan.filter((j) => j.tanggal === t).map((j) => [j.menuId, j]));

  const rows = state.menu.map((m) => {
    const c = catatan[m.id];
    return `<div class="card">
      <b>${esc(m.nama)}</b> <span class="muted">· ${rp(m.hargaJual)}</span>
      <div class="row">
        <div><label for="d-${m.id}">Porsi dibuat</label><input id="d-${m.id}" name="dibuat_${m.id}" inputmode="numeric" value="${c ? c.dibuat : ''}" data-input="sisa" data-menu="${m.id}"></div>
        <div><label for="t-${m.id}">Terjual</label><input id="t-${m.id}" name="terjual_${m.id}" inputmode="numeric" value="${c ? c.terjual : ''}" data-input="sisa" data-menu="${m.id}"></div>
      </div>
      <p class="muted" id="sisa-${m.id}">${c ? `Sisa ${c.dibuat - c.terjual} porsi` : '&nbsp;'}</p>
    </div>`;
  }).join('');

  const r = ringkasan(t, t);
  return `<h1>Catat jualan</h1>
  <form data-form="jualan">
    <label for="j-tgl">Tanggal</label>
    <input id="j-tgl" type="date" value="${t}" data-change="tanggal-jualan">
    <p class="muted">Isi setelah tutup lapak. Stok bahan berkurang otomatis sesuai resep.</p>
    ${rows}
    <button class="btn primary block" type="submit">Simpan jualan</button>
  </form>
  ${r.dibuat ? `<h2>Hasil ${fmtTanggal(t)}</h2><div class="stats">
    ${stat('Penjualan', rp(r.penjualan))}
    ${stat('Untung kotor', rp(r.untungKotor), tanda(r.untungKotor))}
    ${stat('Porsi sisa', angka(r.sisa))}
    ${stat('Nilai modal sisa', rp(r.nilaiSisa), r.nilaiSisa > 0 ? 'neg' : '')}
  </div>` : ''}`;
}

function periodeRange() {
  const t = today();
  switch (ui.periode) {
    case '1': return [t, t, 'Hari ini'];
    case '7': return [addDays(t, -6), t, '7 hari terakhir'];
    case '30': return [addDays(t, -29), t, '30 hari terakhir'];
    default: return [t.slice(0, 8) + '01', t, 'Bulan ini'];
  }
}

function viewLaporan() {
  const [dari, sampai, label] = periodeRange();
  const r = ringkasan(dari, sampai);
  const chip = (v, l) => `<button class="chip ${ui.periode === v ? 'active' : ''}" data-action="periode" data-v="${v}">${l}</button>`;

  let html = `<h1>Laporan</h1>
  <div class="chips">${chip('1', 'Hari ini')}${chip('7', '7 hari')}${chip('30', '30 hari')}${chip('bulan', 'Bulan ini')}</div>
  <p class="muted">${label}: ${fmtTanggal(dari)} – ${fmtTanggal(sampai)}</p>
  <div class="stats">
    ${stat('Penjualan', rp(r.penjualan))}
    ${stat('Modal porsi terjual', rp(r.hppTerjual))}
    ${stat('Untung kotor', rp(r.untungKotor), tanda(r.untungKotor), true)}
    ${stat('Porsi sisa', angka(r.sisa))}
    ${stat('Nilai modal sisa', rp(r.nilaiSisa), r.nilaiSisa > 0 ? 'neg' : '')}
    ${stat('Untung jika sisa tidak laku', rp(r.untungSetelahSisa), tanda(r.untungSetelahSisa), true)}
    ${stat('Uang keluar (belanja)', rp(r.belanja))}
    ${stat('Uang masuk − keluar', rp(r.arusKas), tanda(r.arusKas))}
  </div>`;

  if (r.susut > 0) html += `<div class="alert warn">Bahan susut/terbuang: <b>${rp(r.susut)}</b> (dari penyesuaian stok).</div>`;

  const menus = Object.values(r.perMenu).sort((a, b) => b.untung - a.untung);
  if (menus.length) {
    html += `<h2>Per menu</h2><div class="card"><ul class="list">` +
      menus.map((m) => `<li>
        <div><b>${esc(m.nama)}</b><br><span class="muted">${angka(m.terjual)} terjual · ${angka(m.sisa)} sisa</span></div>
        <div class="right">${rp(m.penjualan)}<br><span class="${tanda(m.untung)}">untung ${rp(m.untung)}</span></div>
      </li>`).join('') + `</ul></div>`;
  }

  const hari = Object.entries(r.perHari).sort((a, b) => b[0].localeCompare(a[0]));
  if (hari.length > 1) {
    html += `<h2>Per hari</h2><div class="card table-wrap"><table>
      <thead><tr><th>Tanggal</th><th>Penjualan</th><th>Untung</th></tr></thead><tbody>` +
      hari.map(([t, h]) => `<tr><td>${fmtTanggal(t)}</td><td>${rp(h.penjualan)}</td><td class="${tanda(h.untung)}">${rp(h.untung)}</td></tr>`).join('') +
      `</tbody></table></div>`;
  }

  if (!menus.length && !r.belanja) html += `<p class="muted">Belum ada catatan pada periode ini.</p>`;
  else html += `<a class="btn block" href="${linkWhatsApp(r, dari, sampai, label)}" target="_blank" rel="noopener">Kirim ringkasan lewat WhatsApp</a>`;
  return html;
}

function linkWhatsApp(r, dari, sampai, label) {
  const teks = [
    `*Laporan ${state.namaUsaha || 'Dagangku'}*`,
    `${label} (${fmtTanggal(dari)} – ${fmtTanggal(sampai)})`,
    `Penjualan: ${rp(r.penjualan)}`,
    `Untung kotor: ${rp(r.untungKotor)}`,
    `Porsi terjual: ${angka(r.terjual)}, sisa: ${angka(r.sisa)}`,
    `Belanja bahan: ${rp(r.belanja)}`,
    ...Object.values(r.perMenu).map((m) => `• ${m.nama}: ${angka(m.terjual)} porsi, untung ${rp(m.untung)}`),
  ].join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(teks);
}

function viewPengaturan() {
  return `<h1>Pengaturan</h1>
  <form class="card" data-form="profil">
    <label for="p-nama">Nama usaha</label>
    <input id="p-nama" name="namaUsaha" value="${esc(state.namaUsaha)}" placeholder="mis. Bakso Pak Kumis">
    <button class="btn primary block" type="submit">Simpan</button>
  </form>
  <div class="card">
    <h2 style="margin-top:0">Cadangan data</h2>
    <p class="muted">Data hanya tersimpan di HP ini. Simpan cadangan secara rutin (mis. kirim ke WhatsApp sendiri) supaya aman kalau HP rusak atau ganti HP.</p>
    <button class="btn block" data-action="ekspor">Simpan file cadangan</button>
    <label class="btn block" for="impor-file" style="color:var(--text)">Pulihkan dari file cadangan</label>
    <input id="impor-file" type="file" accept="application/json,.json" class="hidden" data-change="impor">
  </div>
  <div class="card">
    <h2 style="margin-top:0">Hapus semua data</h2>
    <p class="muted">Tidak bisa dibatalkan. Simpan cadangan dulu.</p>
    <button class="btn danger block" data-action="hapus-semua">Hapus semua data</button>
  </div>
  <p class="muted">Dagangku versi 0.2 · data tidak dikirim ke mana pun.</p>`;
}

/* ---------- Aksi ---------- */

function syncDraftMenu() {
  const form = document.querySelector('[data-form="menu"]');
  if (!form || !ui.draftMenu) return;
  const f = new FormData(form);
  const d = ui.draftMenu;
  d.nama = f.get('nama').trim();
  d.biayaLain = num(f.get('biayaLain'));
  d.hargaJual = num(f.get('hargaJual'));
  d.hargaPasar = num(f.get('hargaPasar'));
  d.targetPersen = num(f.get('targetPersen'));
  d.komposisi = d.komposisi.map((k, i) => ({ bahanId: f.get(`k_bahan_${i}`), jumlah: numJumlah(f.get(`k_jumlah_${i}`)) }));
}

function isiContoh() {
  const t = today();
  const bahan = (nama, satuan, harga) => {
    const b = { id: uid(), nama, satuan, harga };
    state.bahan.push(b);
    return b.id;
  };
  const daging = bahan('Daging sapi giling', 'kg', 130000);
  const tapioka = bahan('Tepung tapioka', 'kg', 12000);
  const mie = bahan('Mie kuning', 'kg', 15000);
  const bumbu = bahan('Bumbu & bawang', 'kg', 40000);
  const sawi = bahan('Sawi', 'ikat', 2000);
  const ayam = bahan('Ayam potong', 'kg', 38000);
  const beras = bahan('Beras', 'kg', 14000);
  const cabai = bahan('Cabai rawit', 'kg', 60000);
  const minyak = bahan('Minyak goreng', 'liter', 18000);
  const tepung = bahan('Tepung bumbu', 'kg', 25000);

  state.menu.push(
    { id: uid(), nama: 'Bakso komplit', hargaJual: 15000, hargaPasar: 18000, targetPersen: 40, biayaLain: 1000,
      komposisi: [{ bahanId: daging, jumlah: 60 }, { bahanId: tapioka, jumlah: 20 }, { bahanId: mie, jumlah: 80 }, { bahanId: bumbu, jumlah: 10 }, { bahanId: sawi, jumlah: 0.2 }] },
    { id: uid(), nama: 'Ayam geprek + nasi', hargaJual: 13000, hargaPasar: 15000, targetPersen: 40, biayaLain: 1000,
      komposisi: [{ bahanId: ayam, jumlah: 150 }, { bahanId: beras, jumlah: 100 }, { bahanId: cabai, jumlah: 20 }, { bahanId: minyak, jumlah: 50 }, { bahanId: tepung, jumlah: 30 }] },
  );

  // Tiap pagi belanja secukupnya (dibulatkan ke atas), lalu catat porsi dibuat & terjual.
  const pola = [[30, 26, 25, 22], [32, 30, 25, 25], [30, 24, 28, 21], [35, 33, 30, 27], [30, 29, 25, 24], [40, 36, 30, 30], [30, 22, 25, 18]];
  pola.forEach(([db, tb, da, ta], i) => {
    const tanggal = addDays(t, i - 6);
    const butuh = {};
    for (const [menu, porsi] of [[state.menu[0], db], [state.menu[1], da]]) {
      for (const p of pemakaianPerPorsi(menu)) butuh[p.bahanId] = (butuh[p.bahanId] || 0) + p.jumlah * porsi;
    }
    for (const [bahanId, jml] of Object.entries(butuh)) {
      const jumlah = Math.ceil(jml * 2) / 2;
      state.belanja.push({ id: uid(), tanggal, bahanId, jumlah, totalHarga: Math.round(jumlah * cariBahan(bahanId).harga) });
    }
    catatJualan(tanggal, state.menu[0], db, tb);
    catatJualan(tanggal, state.menu[1], da, ta);
  });
  save();
}

function catatJualan(tanggal, menu, dibuat, terjual) {
  state.jualan.push({
    id: uid(), tanggal, menuId: menu.id, namaMenu: menu.nama, dibuat, terjual,
    hargaJual: num(menu.hargaJual), hpp: hppMenu(menu), pemakaian: pemakaianPerPorsi(menu),
  });
}

const actions = {
  contoh() { isiContoh(); toast('Contoh data dimuat'); render(); },
  periode(el) { ui.periode = el.dataset.v; render(); },
  'bahan-baru'(el) { setModeBahan(el, true); },
  'bahan-lama'(el) { setModeBahan(el, false); },
  'tab-belanja'(el) { ui.tabBelanja = el.dataset.v; render(); },
  'beli-rencana'(el) {
    const r = state.rencana.find((x) => x.id === el.dataset.id);
    if (!beliRencana(r)) return toast(`Isi jumlah dan harga bayar ${r.nama} dulu`);
    save(); render(); toast(`${r.nama} masuk catatan belanja`);
  },
  'beli-semua-rencana'() {
    const terisi = state.rencana.filter((r) => numJumlah(r.jumlah) > 0 && num(r.total) > 0);
    if (!terisi.length) return toast('Belum ada yang diisi jumlah dan harganya');
    terisi.forEach(beliRencana);
    save(); render();
    toast(`${terisi.length} bahan disimpan${state.rencana.length ? `, ${state.rencana.length} belum dibeli` : ''}`);
  },
  'hapus-rencana'(el) {
    state.rencana = state.rencana.filter((x) => x.id !== el.dataset.id);
    save(); render();
  },
  async 'kosongkan-rencana'() {
    if (!(await tanya({ pesan: 'Kosongkan daftar belanja?', ok: 'Kosongkan', bahaya: true }))) return;
    state.rencana = []; save(); render();
  },
  'rencana-semua-bahan'() {
    const ada = new Set(state.rencana.map((r) => r.bahanId));
    const tambah = state.bahan.filter((b) => !ada.has(b.id));
    for (const b of tambah) state.rencana.push({ id: uid(), bahanId: b.id, nama: b.nama, satuan: b.satuan, jumlah: '', total: '' });
    save(); render();
    toast(tambah.length ? `${tambah.length} bahan ditambahkan` : 'Semua bahan sudah ada di daftar');
  },
  async 'hapus-belanja'(el) {
    if (!(await tanya({ pesan: 'Hapus catatan belanja ini?', ok: 'Hapus', bahaya: true }))) return;
    state.belanja = state.belanja.filter((b) => b.id !== el.dataset.id);
    save(); render();
  },
  async koreksi(el) {
    const b = cariBahan(el.dataset.id);
    const perkiraan = stokBahan(b.id);
    const jawab = await tanya({
      pesan: `Sisa ${b.nama} sebenarnya sekarang berapa ${b.satuan}?\n(Perkiraan aplikasi: ${angka(perkiraan)} ${b.satuan})`,
      ok: 'Simpan',
      input: String(Math.round(Math.max(perkiraan, 0) * 100) / 100),
    });
    if (jawab === null || jawab.trim() === '') return;
    const sebenarnya = numJumlah(jawab);
    const selisih = sebenarnya - perkiraan;
    if (Math.abs(selisih) < 1e-9) return;
    state.koreksi.push({ id: uid(), tanggal: today(), bahanId: b.id, selisih, harga: b.harga });
    save(); render();
    toast(selisih < 0 ? `Susut ${angka(-selisih)} ${b.satuan} (${rp(-selisih * b.harga)}) dicatat` : 'Stok disesuaikan');
  },
  'menu-baru'() {
    ui.draftMenu = { nama: '', hargaJual: 0, hargaPasar: 0, targetPersen: 40, biayaLain: 0, komposisi: [{ bahanId: state.bahan[0].id, jumlah: 0 }] };
    render();
  },
  'edit-menu'(el) { ui.draftMenu = JSON.parse(JSON.stringify(cariMenu(el.dataset.id))); render(); },
  'tambah-komposisi'() { syncDraftMenu(); ui.draftMenu.komposisi.push({ bahanId: state.bahan[0].id, jumlah: 0 }); render(); },
  'hapus-komposisi'(el) { syncDraftMenu(); ui.draftMenu.komposisi.splice(Number(el.dataset.i), 1); render(); },
  'hitung-menu'() { syncDraftMenu(); render(); },
  'batal-menu'() { ui.draftMenu = null; render(); },
  async 'hapus-menu'(el) {
    if (!(await tanya({ pesan: 'Hapus menu ini? Catatan jualan lama tetap tersimpan.', ok: 'Hapus', bahaya: true }))) return;
    state.menu = state.menu.filter((m) => m.id !== el.dataset.id);
    ui.draftMenu = null; save(); render();
  },
  'pakai-saran'(el) {
    const m = cariMenu(el.dataset.id);
    m.hargaJual = saranHarga(m).saran;
    save(); render(); toast(`Harga ${m.nama} jadi ${rp(m.hargaJual)}`);
  },
  ekspor() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dagangku-cadangan-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async 'hapus-semua'() {
    if (!(await tanya({ pesan: 'Yakin hapus SEMUA data? Tidak bisa dibatalkan.', ok: 'Hapus semua', bahaya: true }))) return;
    state = defaultState(); save(); go('beranda'); toast('Semua data dihapus');
  },
};

const forms = {
  belanja(f) {
    let bahanId = f.get('bahanId');
    const jumlah = numJumlah(f.get('jumlah'));
    const total = num(f.get('totalHarga'));
    if (jumlah <= 0 || total <= 0) return toast('Isi jumlah dan total bayar');
    if (bahanId === '__baru') {
      const nama = (f.get('nama') || '').trim();
      if (!nama) return toast('Isi nama bahan');
      const b = { id: uid(), nama, satuan: f.get('satuan'), harga: 0 };
      state.bahan.push(b);
      bahanId = b.id;
    }
    // Harga bahan mengikuti belanja terakhir, jadi modal per porsi selalu pakai harga terbaru.
    cariBahan(bahanId).harga = total / jumlah;
    state.belanja.push({ id: uid(), tanggal: f.get('tanggal'), bahanId, jumlah, totalHarga: total });
    ui.bahanBaru = false;
    save(); render(); toast('Belanja disimpan');
  },
  menu() {
    syncDraftMenu();
    const d = ui.draftMenu;
    if (!d.nama) return toast('Isi nama menu');
    d.komposisi = d.komposisi.filter((k) => k.jumlah > 0);
    if (d.id) Object.assign(cariMenu(d.id), d);
    else state.menu.push({ ...d, id: uid() });
    ui.draftMenu = null;
    save(); render(); toast('Menu disimpan');
  },
  jualan(f) {
    const t = ui.jualanTanggal;
    const baru = [];
    for (const m of state.menu) {
      const terjual = num(f.get(`terjual_${m.id}`));
      const dibuatRaw = f.get(`dibuat_${m.id}`);
      const dibuat = String(dibuatRaw).trim() === '' ? terjual : num(dibuatRaw);
      if (!dibuat && !terjual) continue;
      if (terjual > dibuat) return toast(`${m.nama}: terjual lebih banyak dari yang dibuat`);
      baru.push([m, dibuat, terjual]);
    }
    state.jualan = state.jualan.filter((j) => j.tanggal !== t);
    for (const [m, dibuat, terjual] of baru) catatJualan(t, m, dibuat, terjual);
    save(); render(); toast('Jualan disimpan');
  },
  rencana(f) {
    const bahanId = f.get('bahanId');
    let item;
    if (bahanId === '__baru') {
      const nama = (f.get('nama') || '').trim();
      if (!nama) return toast('Isi nama bahan');
      item = { bahanId: null, nama, satuan: f.get('satuan') };
    } else {
      const b = cariBahan(bahanId);
      item = { bahanId: b.id, nama: b.nama, satuan: b.satuan };
    }
    state.rencana.push({ id: uid(), ...item, jumlah: (f.get('jumlah') || '').trim(), total: '' });
    save(); render(); toast(`${item.nama} ditambahkan ke daftar`);
  },
  profil(f) {
    state.namaUsaha = f.get('namaUsaha').trim();
    save(); render(); toast('Tersimpan');
  },
};

const changes = {
  'sync-menu'() { syncDraftMenu(); render(); },
  'tanggal-jualan'(el) { ui.jualanTanggal = el.value || today(); render(); },
  impor(el) {
    const file = el.files[0];
    if (!file) return;
    file.text().then(async (txt) => {
      const data = JSON.parse(txt);
      if (!Array.isArray(data.bahan) || !Array.isArray(data.menu) || !Array.isArray(data.jualan)) throw new Error('format');
      el.value = '';
      if (!(await tanya({ pesan: 'Data di HP ini akan diganti dengan isi file cadangan. Lanjut?', ok: 'Pulihkan' }))) return;
      state = Object.assign(defaultState(), data);
      save(); go('beranda'); toast('Data dipulihkan');
    }).catch(() => toast('File cadangan tidak valid'));
  },
};

function hargaSatuanPreview() {
  const form = document.querySelector('[data-form="belanja"]');
  const out = document.getElementById('harga-satuan');
  if (!form || !out) return;
  const f = new FormData(form);
  const jumlah = numJumlah(f.get('jumlah'));
  const total = num(f.get('totalHarga'));
  const satuan = f.get('bahanId') === '__baru' ? f.get('satuan') : (cariBahan(f.get('bahanId')) || {}).satuan;
  out.innerHTML = jumlah > 0 && total > 0 ? `Harga per ${satuan}: <b>${rp(total / jumlah)}</b>` : '&nbsp;';
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return go(nav.dataset.nav);
  const act = e.target.closest('[data-action]');
  if (act && actions[act.dataset.action]) {
    e.preventDefault();
    actions[act.dataset.action](act);
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form](new FormData(form));
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el);
});

document.addEventListener('input', (e) => {
  if (e.target.closest('[data-form="belanja"]')) hargaSatuanPreview();
  const ri = e.target.closest('[data-rencana]');
  if (ri) {
    const r = state.rencana.find((x) => x.id === ri.dataset.rencana);
    r[ri.dataset.field] = ri.value.trim();
    save();
    document.getElementById('rp-' + r.id).textContent = teksPerkiraan(r);
    document.getElementById('rencana-total').innerHTML = teksTotalRencana();
    document.getElementById('rencana-wa').href = linkDaftarWhatsApp();
  }
  const el = e.target.closest('[data-input="sisa"]');
  if (el) {
    const id = el.dataset.menu;
    const d = num(document.getElementById('d-' + id).value);
    const t = num(document.getElementById('t-' + id).value);
    document.getElementById('sisa-' + id).textContent = d || t ? (t > d && d ? 'Terjual melebihi porsi dibuat' : `Sisa ${Math.max(d - t, 0)} porsi`) : ' ';
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();

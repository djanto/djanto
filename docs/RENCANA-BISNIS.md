# Rencana Bisnis Dagangku

## Sasaran

Pedagang makanan kaki lima: bakso, ayam geprek, mie ayam, nasi goreng, gorengan, dan sejenisnya.
Masalah mereka: tidak tahu modal per porsi, tidak tahu untung sebenarnya, dan uang usaha tercampur dengan uang pribadi.

## Gratis vs berbayar

Prinsipnya, fitur yang membuat pedagang **mulai memakai** aplikasi digratiskan, sedangkan fitur yang membuat mereka **untung lebih banyak** atau **menghemat waktu** dibuat berbayar. Sejak awal tulis di aplikasi bahwa fitur premium akan berbayar, supaya pengguna tidak merasa dijebak.

| Fitur | Gratis | Premium (± Rp1.000/hari) |
|---|---|---|
| Catat belanja, harga per kg | ✅ | ✅ |
| Hitung modal per porsi (maks. 3 menu) | ✅ | ✅ menu tanpa batas |
| Catat jualan & sisa harian | ✅ | ✅ |
| Laporan hari ini | ✅ | ✅ |
| Laporan mingguan & bulanan, per menu | — | ✅ |
| Saran harga dari harga pasaran | 1 menu | ✅ semua menu |
| Laporan bahan susut/terbuang | — | ✅ |
| Cadangan otomatis ke internet & pindah HP | — | ✅ |
| Laporan PDF untuk pengajuan KUR/bank | — | ✅ (atau bayar per laporan Rp25–50rb) |
| Lebih dari 1 gerobak/cabang | — | Paket bisnis |
| Laporan bulanan dicek ahli keuangan | — | Paket plus (layanan manusia) |

## Penarikan biaya harian

Harga ditampilkan **"Rp1.000/hari"**, karena angka harian terasa ringan. Ada dua cara menagihnya:

1. **Saldo isi ulang (seperti pulsa)**: pengguna top-up misalnya Rp30rb lewat QRIS (Midtrans/Xendit), lalu saldo terpotong Rp1.000 per hari aplikasi dipakai. Ini paling sesuai dengan ide harian. *Catatan: kalau aplikasi masuk Play Store, aturan pembayaran Google Play untuk produk digital perlu dicek dulu saat tahap itu.*
2. **Langganan Play Store mingguan** Rp7.000/minggu, ditampilkan sebagai "Rp1.000/hari". Google Play tidak menyediakan langganan harian, minimal per minggu. Google memotong 15%.

Tetap tampilkan potongan dengan jelas: saldo tersisa dan riwayat potongan. Penagihan yang terasa diam-diam memancing ulasan bintang 1 dan bisa melanggar aturan toko aplikasi.

## Tahapan

1. **Sekarang, versi 0.1 (sudah jadi)**: aplikasi web, data di HP, tanpa server, gratis.
2. **Uji lapangan (2–4 minggu)**: pasang di HP 5–10 pedagang yang dikenal. Dampingi langsung, lalu catat bagian yang membingungkan dan fitur yang diminta.
3. **Versi 0.2**: perbaikan dari masukan, batasan fitur gratis, dan halaman "Premium segera hadir".
4. **Akun & cadangan internet**: pakai layanan siap pakai seperti **Supabase** atau **Firebase** (ada paket gratis). **Tidak perlu server fisik.** Di tahap ini mulai berlaku kebijakan privasi dan keamanan data (login, enkripsi koneksi, akses data hanya milik pengguna sendiri).
5. **Mulai tagih**: saldo harian atau langganan.
6. **Play Store**: bungkus aplikasi web ini memakai **PWABuilder** (pwabuilder.com) menjadi aplikasi Android (TWA), tanpa menulis ulang aplikasinya.
   - Daftar akun Google Play Developer: bayar sekali USD 25, verifikasi identitas (KTP).
   - Akun pribadi baru wajib uji tertutup minimal **12 penguji selama 14 hari** sebelum bisa rilis publik. Para pedagang di tahap uji lapangan bisa jadi penguji ini.
   - Siapkan link kebijakan privasi, ikon, dan screenshot.

## Hitungan target

Asumsi 3–5% pengguna aktif mau membayar Rp30rb/bulan:

| Pengguna aktif | Pembayar | Pendapatan/bulan |
|---|---|---|
| 500 | 15–25 | Rp450rb–750rb |
| 3.000 | 90–150 | Rp2,7–4,5 jt |
| 10.000 | 300–500 | Rp9–15 jt |

Cara mendapat pengguna: datangi langsung pedagang di sekitar, titip di paguyuban PKL atau komunitas UMKM, buat video pendek "modal semangkok bakso sebenarnya berapa?", dan beri bonus saldo untuk pengguna yang mengajak teman.

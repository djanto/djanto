# Dagangku

Aplikasi catatan modal dan untung untuk **pedagang makanan kaki lima** (bakso, ayam geprek, dan sejenisnya).

## Fitur versi 0.3

- **Daftar belanja**: susun daftar dengan harga kosong, isi harga saat di pasar, lihat perkiraan uang yang perlu dibawa, kirim daftar lewat WhatsApp.
- **Belanja bahan**: catat jumlah dan total bayar, harga per kg/liter/pcs dihitung otomatis.
- **Olahan (bahan siap jual)**: catat bahan mentah yang diolah, mis. 3 kg ayam + tepung jadi 30 potong siap goreng. Modal per potong dihitung otomatis, stok mentah berkurang, dan sisa potong siap jual terlihat di Beranda, Olahan, dan Jualan.
- **Menu & resep**: tulis bahan per porsi (boleh memakai bahan siap jual, mis. 1 potong ayam goreng), **modal per porsi (HPP)** dihitung otomatis.
- **Saran harga**: bandingkan dengan harga pasaran. Kalau hargamu masih di bawah pasaran, aplikasi menyarankan harga baru supaya untung naik tapi tetap bersaing. Kalau harga jual di bawah modal, muncul peringatan rugi.
- **Catat jualan harian**: porsi dibuat, terjual, dan sisa. Stok bahan berkurang otomatis sesuai resep.
- **Sesuaikan stok**: isi sisa bahan sebenarnya, selisihnya dicatat sebagai bahan susut/terbuang.
- **Laporan**: hari ini, 7 hari, 30 hari, atau bulan ini. Berisi penjualan, untung kotor, nilai porsi sisa, dan uang masuk − keluar, per menu dan per hari. Bisa dikirim lewat WhatsApp.
- **Tanpa server dan tanpa internet**: data tersimpan di HP pengguna, dengan cadangan berupa file.

## Cara mencoba di komputer

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`. Di halaman Beranda, tekan **"Coba dengan contoh data"**.

## Cara membuatnya online (gratis)

Pilih salah satu:

1. **Netlify Drop**: buka https://app.netlify.com/drop, lalu tarik folder ini ke halaman tersebut. Link aplikasi langsung jadi.
2. **Cloudflare Pages** atau **GitHub Pages**: hubungkan ke repo ini. Catatan: GitHub Pages gratis hanya untuk repo publik.

Setelah online, buka link-nya di HP dengan Chrome, lalu pilih menu ⋮ → **"Tambahkan ke layar utama"**. Aplikasi akan muncul seperti aplikasi biasa.

## Struktur file

| File | Isi |
|---|---|
| `index.html` | Kerangka halaman |
| `styles.css` | Tampilan (otomatis mode gelap) |
| `app.js` | Semua logika: perhitungan, layar, penyimpanan |
| `sw.js` | Supaya bisa dibuka tanpa internet. **Naikkan `VERSI` setiap kali mengubah file.** |
| `manifest.webmanifest`, `icons/` | Identitas aplikasi saat dipasang di HP |
| `docs/RENCANA-BISNIS.md` | Rencana harga, tahapan, dan jalan menuju Play Store |

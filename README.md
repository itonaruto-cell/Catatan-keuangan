# Catatan Keuangan

Aplikasi web (bisa dipasang di HP) untuk mencatat uang masuk & keluar, dompet (bank, e-wallet, tunai), investasi, dan piutang teman.

- Catat manual, lewat suara (Chrome, bahasa Indonesia), atau foto struk (dibaca di HP dengan Tesseract).
- Impor file Excel/CSV dari aplikasi lama, dengan pencocokan kolom.
- Cadangan ke Google Drive (otomatis harian) dan cadangan manual ke file.
- Warna (biru, hijau, ungu, merah, jingga) dan mode terang/gelap di Pengaturan.

Data disimpan di perangkat (IndexedDB). Cadangkan rutin agar aman.

## Menjalankan

```bash
npm install
npm run dev     # pengembangan
npm test        # tes
npm run build   # build produksi ke dist/
```

## Mengaktifkan cadangan Google Drive

1. Buat OAuth Client ID tipe "Web application" di Google Cloud Console, aktifkan Google Drive API.
2. Tambahkan domain aplikasi (mis. `https://catatan-keuangan.vercel.app`) ke "Authorized JavaScript origins".
3. Isi environment variable `VITE_GOOGLE_CLIENT_ID` di Vercel, lalu deploy ulang.

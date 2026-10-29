# NEONWAVE — Playlist & Queue Update

## Fitur baru
- Membuat dan menghapus playlist.
- Menambahkan lagu ke playlist dari daftar lagu.
- Memutar playlist berdasarkan urutan lagu.
- Menambahkan lagu ke antrean, mengubah urutan naik/turun, memutar langsung, menghapus item, dan mengosongkan antrean.
- Antrean diprioritaskan saat lagu selesai.
- Playlist dan antrean tersimpan di localStorage browser/perangkat yang sama.

## File yang diperbarui
- `index.html`: navigasi Playlists, form playlist, dialog antrean dan pemilih playlist.
- `script.js`: logika playlist, antrean, penyimpanan lokal, dan tombol tambah.
- `style.css`: gaya tambahan yang mempertahankan tema premium.

## Cara memasang di GitHub Pages
1. Download/backup repository yang sekarang.
2. Ekstrak ZIP update ini.
3. Upload/replace `index.html`, `style.css`, dan `script.js` di root repository.
4. Commit dengan pesan `Add playlists and queue`.
5. Buka situs GitHub Pages lalu hard refresh dengan `Ctrl + F5`.

## Catatan
Data playlist dan antrean disimpan di browser/perangkat yang sama; belum tersinkron antar perangkat/pengguna. Audio demo masih memakai URL contoh yang sudah ada. Untuk penggunaan komersial, ganti dengan audio yang memiliki izin/lisensi.

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


## Login + database (Supabase)
Login/database is optional until configured. The player, playlists, favorites and queue continue to work locally if Supabase isn't configured.

1. Create a project at https://supabase.com/.
2. In Supabase Project Settings > API, copy the Project URL and the publishable/anon key. Do NOT use `service_role` or any secret key in browser code.
3. Replace the placeholders in `config.js` with your Project URL and publishable/anon key.
4. Open Supabase SQL Editor and run the full contents of `supabase-schema.sql`.
5. In Authentication > URL Configuration, add your GitHub Pages origin to the allowed redirect URLs (for this site, add `https://syahdankurniawan85-ux.github.io/**`; adjust to your actual deployed path/domain).
6. Upload/replace `index.html`, `style.css`, `script.js`, `config.js`, and `supabase-schema.sql` at the same root level in the GitHub Pages project, then commit.
7. Open the deployed site, click `Masuk`, create an account, confirm email if requested, and sign in.

The browser key is designed to be public; security relies on Row Level Security policies in `supabase-schema.sql`. Never publish a service-role/secret key. Per-user favorites, playlists and queue are saved to the `neonwave_user_data` table. Existing local data is copied to the cloud the first time an account signs in and has no row yet.

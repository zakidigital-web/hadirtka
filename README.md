# HadirTKA

Aplikasi absensi, jurnal mengajar, dan laporan TKA untuk guru dan admin.

## Jalankan secara lokal

Gunakan Node.js 26 dan Bun. Pada direktori proyek, jalankan:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
```

Isi `HADIRTKA_ADMIN_PASSWORD` dan `HADIRTKA_TEACHER_PASSWORD` pada `.env.local` dengan dua kata sandi berbeda, masing-masing minimal 12 karakter. Jalankan `npm run dev`, lalu buka alamat yang ditampilkan Vite.

Pada instalasi baru, username admin adalah `admin`. Akun guru contoh memakai username `guru.a` hingga `guru.d` dan kata sandi awal guru. Guru dapat mengganti kata sandi melalui profil. Admin dapat mengelola akun lewat **Akun Guru**.

Server memakai konfigurasi kata sandi saat pertama membuat akun. Akun dan sesi disimpan di SQLite pada server. Data absensi dan jurnal disimpan di browser. Nama siswa dan wali dalam data awal adalah contoh. Masukkan nomor tujuan sendiri untuk menggunakan pengiriman WhatsApp pribadi.

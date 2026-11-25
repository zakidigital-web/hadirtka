# HadirTKA

Absensi, jurnal mengajar, laporan dan pengelolaan akun sekolah. Frontend React/Vite menggunakan API Node.js dan satu database PostgreSQL bersama.

## Deploy di Vercel

1. Impor repositori GitHub ini sebagai proyek Vite. Gunakan direktori root, Node.js 24, perintah build `npm run build`, dan direktori hasil `dist`. Vercel menggunakan `bun.lock` saat memasang dependensi.
2. Hubungkan Neon Postgres lewat **Storage → Marketplace → Neon**, atau gunakan database PostgreSQL yang sudah ada. Pilih region database dekat dengan region fungsi. Gunakan koneksi pooled dari Neon dengan TLS.
3. Isi variabel server pada **Settings → Environment Variables**. `DATABASE_URL` berisi URL koneksi PostgreSQL. `HADIRTKA_ADMIN_PASSWORD` dan `HADIRTKA_TEACHER_PASSWORD` berisi dua kata sandi awal yang berbeda, masing-masing minimal 12 karakter. Jangan gunakan awalan `VITE_` untuk nilai tersebut. Gunakan database atau branch terpisah untuk Preview dan Production.
4. Jika memindahkan akun lama, jalankan impor akun di bawah sebelum membuka aplikasi. Deploy atau redeploy setelah konfigurasi tersedia. API membuat tabel ketika pertama kali diakses. Instalasi baru menyediakan kelas 9A–9D, admin `admin`, dan guru contoh `guru.a` sampai `guru.d`. Admin dapat menghapus atau mengganti kata sandi akun contoh melalui **Akun Guru**.
5. Uji dengan dua browser: admin menambah siswa, guru mengisi absensi dan jurnal, lalu admin membuka laporan pada tanggal yang sama. Data dimuat ulang ketika jendela aktif dan secara berkala selama aplikasi terbuka.

## Pengembangan lokal

Gunakan Node.js 24, Bun, dan PostgreSQL lokal atau database Neon khusus pengembangan.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
# Isi variabel pada .env.local
npm run dev
```

`npm run lint` memeriksa TypeScript. `npm run build` membangun frontend. API lokal dan Vercel memakai implementasi yang sama.

## Memindahkan data lama

Gunakan salinan cadangan, hentikan pencatatan pada aplikasi lama selama pemindahan, dan letakkan berkas ekspor di luar repositori atau di `private-import/`. Jalankan migrasi dari komputer tepercaya dengan `.env.local` yang menunjuk ke database tujuan.

- **Akun** — sebelum permintaan API pertama ke database baru, jalankan `npm run migrate -- accounts /lokasi/accounts.sqlite`. Skrip mempertahankan ID, profil, status, dan hash kata sandi dari versi SQLite yang memiliki tabel `profiles`. Pengguna perlu masuk kembali.
- **Data sekolah** — di setiap browser asal, buka aplikasi lama pada alamat yang biasa digunakan. Di konsol alat pengembang, jalankan potongan berikut untuk mengunduh salinan JSON. File berisi data siswa dan kontak wali.

```js
const data = localStorage.getItem('hadirtka_smpn1genteng_v3');
if (!data) throw new Error('Data tidak ditemukan pada browser dan alamat ini.');
const link = document.createElement('a');
link.href = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
link.download = 'hadirtka-sekolah.json';
link.click();
setTimeout(() => URL.revokeObjectURL(link.href), 1000);
```

Untuk setiap salinan, jalankan `npm run migrate -- school /lokasi/hadirtka-sekolah.json`. Impor mengabaikan rekaman identik. Jika dua perangkat memiliki nilai berbeda untuk ID yang sama, transaksi berkas tersebut dibatalkan dan menampilkan ID konflik. Periksa salinan bersama operator sekolah sebelum mengulang impor. Verifikasi jumlah siswa, absensi dan laporan harian sebelum beralih ke alamat Vercel.

[Dokumentasi Vite di Vercel](https://vercel.com/docs/frameworks/frontend/vite) · [Integrasi Neon di Vercel](https://vercel.com/marketplace/neon)

## Cadangan dan pemulihan

Masuk sebagai admin, lalu buka **Analitik → Cadangan database**. Pilih kata sandi cadangan (minimal 12 karakter), ulangi, lalu unduh file `.htbackup`. Simpan file di perangkat atau media terpisah dari database. Simpan kata sandinya di pengelola kata sandi. File terenkripsi memuat akun beserta hash kata sandi, profil, data siswa, kelas, absensi, jurnal, antrean WA dan pengaturan.

Untuk memulihkan, pilih file dan masukkan kata sandi yang dipakai saat mencadangkan. **Periksa cadangan** menampilkan waktu pembuatan dan jumlah rekaman sebelum penggantian. Unduh cadangan kondisi terkini jika diperlukan. Ketik **PULIHKAN** dan tekan **Pulihkan database** untuk mengganti data aktif. Setelah selesai, semua pengguna harus masuk kembali dengan akun dan kata sandi dari cadangan.

Untuk pemulihan ke database Neon baru, hubungkan aplikasi ke database tujuan, masuk dengan admin awal, lalu gunakan file cadangan. URL koneksi database dan konfigurasi Vercel diatur di lingkungan tujuan. Transfer file dibagi menjadi beberapa bagian dengan batas total 64 MiB per file terenkripsi dan 192 MiB data sebelum kompresi. Sesi transfer berlaku 30 menit.

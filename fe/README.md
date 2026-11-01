# SiCARE Frontend

Frontend React + TypeScript untuk website konseling SiCARE.

## Menjalankan frontend

1. Pastikan backend SiCARE berjalan pada `http://127.0.0.1:3000`.
2. Salin `fe/.env.example` menjadi `fe/.env.local`.
3. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` menggunakan nilai publik dari project Supabase yang sama dengan backend. `VITE_SUPABASE_ANON_KEY` hanya digunakan sebagai fallback proyek lama.
4. Pastikan `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1` dan origin frontend (`http://localhost:5173`) diizinkan oleh `FRONTEND_ORIGINS` pada backend.
5. Jalankan `npm ci`, lalu `npm run dev` dari folder `fe`.

Jangan pernah memasukkan `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, atau token Fonnte ke variabel `VITE_*`. Variabel `VITE_*` akan masuk ke bundle browser.

## Autentikasi

- Login menerima email, NIM, atau NIP beserta kata sandi.
- Untuk NIM/NIP, backend mencari kode identitas di `profiles` lalu menyelesaikan email akun melalui Supabase Auth di server. Email dan kunci admin tidak dikirim ke browser.
- Registrasi mandiri hanya membuat role aplikasi `client`. Kategori `student` atau `faculty_staff` adalah kategori keanggotaan, bukan role aplikasi.
- Role konselor, admin, dan Kepala LMI harus ditetapkan melalui proses administrasi.
- Sesi browser disimpan oleh Supabase client di `sessionStorage`, dipulihkan saat halaman dimuat ulang, dan profil diverifikasi kembali melalui `GET /api/v1/auth/me`.
- Route dashboard dilindungi berdasarkan `profiles.app_role`. Proteksi route frontend hanya lapisan UX; otorisasi backend tetap wajib.
- Jika konfirmasi email diaktifkan di Supabase, pengguna perlu mengonfirmasi email sebelum dapat login.

## Pemeriksaan

Jalankan `npm run build` dan `npm run lint` dari folder `fe` setelah perubahan.

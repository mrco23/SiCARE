# Sistem Konseling Frontend

Refactor awal project React untuk sistem konseling kampus.

## Perubahan
- Migrasi struktur feature-based architecture
- Pemisahan halaman berdasarkan role
- Setup routing menggunakan React Router
- Penambahan type model user dan booking
- Penambahan constant status workflow konseling

## Role
- Client
- Counselor
- Admin
- Head LMI

## Struktur utama
src/
- app : router dan konfigurasi aplikasi
- pages : halaman berdasarkan role
- layouts : layout public dan dashboard
- features : modul bisnis
- types : interface TypeScript
- constants : enum status

Tahap berikutnya:
- Integrasi backend API
- Authentication JWT/cookie
- TanStack Query
- Form validation
- Calendar booking
- Notification service

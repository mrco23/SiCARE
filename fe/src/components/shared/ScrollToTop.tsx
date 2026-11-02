import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Komponen pemulihan scroll global pada setiap transisi rute (pathname).
 * - Mengembalikan posisi scroll window, document, dan container layout (main) ke puncak.
 * - Mempertahankan posisi scroll pada perubahan query tab/filter lokal di halaman yang sama.
 * - Mendukung navigasi tautan jangkar (hash/anchor) dan tidak mengganggu modal aktif.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Jika terdapat hash tautan jangkar, arahkan elemen ke viewport
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView();
        return;
      }
    }

    // Kembalikan posisi scroll window dan root document
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Reset scroll pada container konten utama aplikasi (misalnya elemen main)
    const scrollContainers = document.querySelectorAll("main, [data-scrollable]");
    scrollContainers.forEach((container) => {
      container.scrollTop = 0;
    });
  }, [pathname, hash]);

  return null;
}

export default ScrollToTop;


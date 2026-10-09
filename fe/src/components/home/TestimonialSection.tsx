import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';

interface Testimonial {
  id: string;
  anonymous: string;
  role: string;
  rating: number;
  text: string;
  category: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    anonymous: 'G*****a',
    role: 'Mahasiswa Semester 6',
    rating: 5,
    text: 'Awalnya saya ragu untuk mencoba konseling. Tapi setelah sesi pertama, saya merasa jauh lebih lega. Konselor sangat sabar mendengarkan dan tidak menghakimi sama sekali. Terima kasih SiCARE!',
    category: 'Kesehatan Mental',
  },
  {
    id: 't2',
    anonymous: 'R*****n',
    role: 'Mahasiswa Baru',
    rating: 5,
    text: 'Saya mengalami culture shock saat pertama kuliah. Dengan bantuan konselor, saya belajar cara beradaptasi dan membangun rasa percaya diri. Prosesnya mudah dan tidak menyulitkan sama sekali.',
    category: 'Adaptasi & Akademik',
  },
  {
    id: 't3',
    anonymous: 'F*****i',
    role: 'Mahasiswa Tingkat Akhir',
    rating: 5,
    text: 'Tekanan skripsi hampir membuatku menyerah. Layanan konseling karir di SiCARE membantu saya menemukan kembali motivasi dan strategi yang tepat. Sangat direkomendasikan!',
    category: 'Karir & Akademik',
  },
  {
    id: 't4',
    anonymous: 'A*****s',
    role: 'Mahasiswa Semester 4',
    rating: 4,
    text: 'Sistem booking sangat mudah digunakan. Konselor saya sangat profesional dan selalu menepati waktu. Sesi konseling online juga nyaman dan terasa personal.',
    category: 'Pengalaman Layanan',
  },
  {
    id: 't5',
    anonymous: 'D*****a',
    role: 'Mahasiswi Semester 3',
    rating: 5,
    text: 'Masalah hubungan yang sudah lama saya pendam akhirnya bisa saya hadapi dengan lebih bijak berkat bimbingan konselor di sini. Privasi terjaga dan tidak perlu khawatir.',
    category: 'Hubungan Sosial',
  },
  {
    id: 't6',
    anonymous: 'H*****o',
    role: 'Mahasiswa Pasca Sarjana',
    rating: 5,
    text: 'Konseling manajemen stres benar-benar mengubah cara saya menghadapi deadline dan tekanan akademik. Kini saya lebih produktif dan bahagia. Platform ini luar biasa!',
    category: 'Manajemen Stres',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-base ${i <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function TestimonialSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [currentPage, setCurrentPage] = useState(0);
  const perPage = 3;
  const totalPages = Math.ceil(TESTIMONIALS.length / perPage);
  const visible = TESTIMONIALS.slice(currentPage * perPage, currentPage * perPage + perPage);

  return (
    <section
      id="testimonials"
      className="section-padding bg-[#064E3B] px-6 relative overflow-hidden"
      ref={ref}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#0A7A5C] rounded-full blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#043D2E] rounded-full blur-2xl opacity-50 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-bold text-[#DFF5E8] bg-[#0A7A5C]/40 border border-[#DFF5E8]/20 px-4 py-1.5 rounded-full mb-4 tracking-wide uppercase">
            Testimoni
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
            Suara dari Mereka yang{' '}
            <span className="text-[#DFF5E8]">Telah Melangkah</span>
          </h2>
          <p className="text-green-200 text-base max-w-xl mx-auto leading-relaxed font-medium">
            Identitas pengguna dirahasiakan sepenuhnya untuk menjaga privasi.
          </p>
        </motion.div>

        {/* Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid md:grid-cols-3 gap-6 mb-10"
          >
            {visible.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-3xl p-6 hover:bg-white/15 transition-all duration-300 cursor-default"
              >
                {/* Quote icon */}
                <div className="w-10 h-10 rounded-xl bg-[#DFF5E8]/20 flex items-center justify-center mb-4">
                  <Quote size={18} className="text-[#DFF5E8]" />
                </div>

                {/* Category badge */}
                <span className="inline-block text-xs bg-[#0A7A5C]/50 text-green-200 border border-green-400/20 px-3 py-1 rounded-full font-semibold mb-3">
                  {t.category}
                </span>

                {/* Testimonial text */}
                <p className="text-green-100 text-sm leading-relaxed mb-5 italic">
                  "{t.text}"
                </p>

                {/* Divider */}
                <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{t.anonymous}</p>
                    <p className="text-green-300 text-xs mt-0.5">{t.role}</p>
                  </div>
                  <StarRating rating={t.rating} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Pagination */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-4"
        >
          <button
            id="testimonial-prev-btn"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition-colors cursor-pointer disabled:cursor-not-allowed"
            aria-label="Testimonial sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                id={`testimonial-page-${i}`}
                onClick={() => setCurrentPage(i)}
                aria-label={`Halaman ${i + 1}`}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  i === currentPage
                    ? 'w-8 h-2.5 bg-white'
                    : 'w-2.5 h-2.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>

          <button
            id="testimonial-next-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition-colors cursor-pointer disabled:cursor-not-allowed"
            aria-label="Testimonial berikutnya"
          >
            <ChevronRight size={18} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}

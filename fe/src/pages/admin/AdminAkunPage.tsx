import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "../../components/shared";
import {
  Search,
  SquarePen,
  User,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */
type Role =
  | "Konselor"
  | "Mahasiswa"
  | "Dosen"
  | "Staff"
  | "Kepala LMI"
  | "Admin";
type Tab = "Semua" | "Konselor" | "Klien" | "Kepala LMI" | "Admin";

type Account = {
  id: number;
  name: string;
  code: string; // NIM / NIP
  email: string;
  role: Role;
  active: boolean;
  created: string; // ISO (YYYY-MM-DD)
};

type FormState = {
  name: string;
  code: string;
  email: string;
  role: Role;
  active: boolean;
};

/* ===== DATA CONTOH =====
   Ganti dengan data dari backend, mis. fetch('/api/admin/akun').
   Peran klien disimpan sebagai salah satu: Mahasiswa | Dosen | Staff. */
const ROLES: Role[] = [
  "Konselor",
  "Mahasiswa",
  "Dosen",
  "Staff",
  "Kepala LMI",
  "Admin",
];
const CLIENT_ROLES: Role[] = ["Mahasiswa", "Dosen", "Staff"]; // termasuk dalam filter "Klien"
const TABS: Tab[] = ["Semua", "Konselor", "Klien", "Kepala LMI", "Admin"];

const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 1,
    name: "Giovanna Yudi, M.Psi",
    code: "198705122014",
    email: "giovanna@unikadelasalle.ac.id",
    role: "Konselor",
    active: true,
    created: "2024-08-01",
  },
  {
    id: 2,
    name: "Rico Kornelius Wahani",
    code: "198901042015",
    email: "rico@unikadelasalle.ac.id",
    role: "Konselor",
    active: true,
    created: "2024-08-01",
  },
  {
    id: 3,
    name: "Yusli Ngongano",
    code: "2210011045",
    email: "yusli@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    active: true,
    created: "2025-08-20",
  },
  {
    id: 4,
    name: "Ayu Pratiwi",
    code: "2110022018",
    email: "ayu@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    active: true,
    created: "2025-08-22",
  },
  {
    id: 5,
    name: "Bagas Hermawan",
    code: "197612032005",
    email: "bagas@unikadelasalle.ac.id",
    role: "Dosen",
    active: false,
    created: "2025-09-02",
  },
  {
    id: 6,
    name: "Dr. Maria Kaunang",
    code: "196804151993",
    email: "maria@unikadelasalle.ac.id",
    role: "Kepala LMI",
    active: true,
    created: "2024-07-15",
  },
  {
    id: 7,
    name: "Admin SiCARE",
    code: "-",
    email: "admin@unikadelasalle.ac.id",
    role: "Admin",
    active: true,
    created: "2024-07-01",
  },
  {
    id: 8,
    name: "Chelsea Ngongano",
    code: "2310033077",
    email: "chelsea@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    active: true,
    created: "2025-10-01",
  },
  {
    id: 9,
    name: "Stefanus Lumoindong",
    code: "199203102019",
    email: "stefanus@unikadelasalle.ac.id",
    role: "Staff",
    active: true,
    created: "2025-03-11",
  },
];

const ROLE_STYLE: Record<Role, string> = {
  Konselor: "bg-primary-subtle text-primary border-emerald-100",
  Mahasiswa: "bg-sky-50 text-sky-700 border-sky-100",
  Dosen: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Staff: "bg-teal-50 text-teal-700 border-teal-100",
  "Kepala LMI": "bg-violet-50 text-violet-700 border-violet-100",
  Admin: "bg-amber-50 text-amber-700 border-amber-100",
};

/* ========================= HELPER ========================= */
const initials = (n: string) =>
  n
    .split(" ")
    .filter((w) => /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// Apakah akun masuk ke tab tertentu
const inTab = (a: Account, tab: Tab) =>
  tab === "Semua"
    ? true
    : tab === "Klien"
      ? CLIENT_ROLES.includes(a.role)
      : a.role === tab;

// Peran default saat membuka modal "Tambah Akun", mengikuti tab yang sedang aktif
const defaultRoleForTab = (tab: Tab): Role =>
  tab === "Semua" || tab === "Klien" ? "Mahasiswa" : (tab as Role);

const emptyForm = (tab: Tab): FormState => ({
  name: "",
  code: "",
  email: "",
  role: defaultRoleForTab(tab),
  active: true,
});

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/30";

/* ========================= HALAMAN ========================= */
export default function AdminAkunPage() {
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [tab, setTab] = useState<Tab>("Semua");
  const [query, setQuery] = useState("");

  // Modal tambah / ubah
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm("Semua"));
  const [showError, setShowError] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => inTab(a, tab))
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, tab, query]);

  /* ===== MODAL ===== */
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(tab));
    setShowError(false);
    setModalOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      code: a.code,
      email: a.email,
      role: a.role,
      active: a.active,
    });
    setShowError(false);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const save = () => {
    const data: FormState = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim() || "-",
      email: form.email.trim(),
    };
    if (!data.name || !data.email) {
      setShowError(true);
      return;
    }

    if (editingId !== null) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, ...data } : a)),
      );
    } else {
      setAccounts((prev) => [
        ...prev,
        {
          id: Math.max(0, ...prev.map((a) => a.id)) + 1,
          ...data,
          created: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    closeModal();
  };

  const toggleActive = (id: number) =>
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    );

  return (
    <PageContainer role="admin">
      <PageHeader
        title="Manajemen Akun"
        description="Kelola akun konselor, klien (mahasiswa, dosen, staff), kepala LMI, dan admin."
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          {TABS.map((t) => {
            const n = accounts.filter((a) => inTab(a, t)).length;
            const on = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 transition-colors ${
                  on
                    ? "bg-white text-slate-800 shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                {t} <span className="ml-1 text-[10px] text-slate-400">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, NIM, atau NIP..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
        >
          <UserPlus className="h-4 w-4" /> Tambah Akun
        </button>
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-400">
            Menampilkan {rows.length} dari {accounts.length} akun
          </p>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Akun</th>
                  <th className="px-6 py-3">NIM / NIP</th>
                  <th className="px-6 py-3">Peran</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Dibuat</th>
                  <th className="px-6 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {initials(a.name)}
                        </div>
                        <div>
                          <p className="font-semibold">{a.name}</p>
                          <p className="text-xs text-slate-400">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {a.code}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${ROLE_STYLE[a.role]}`}
                      >
                        {a.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          a.active ? "text-primary" : "text-slate-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            a.active ? "bg-brand-accent" : "bg-slate-300"
                          }`}
                        />
                        {a.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {fmtDate(a.created)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title="Ubah"
                          onClick={() => openEdit(a)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary"
                        >
                          <SquarePen className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title={a.active ? "Nonaktifkan" : "Aktifkan"}
                          onClick={() => toggleActive(a.id)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 ${
                            a.active
                              ? "hover:text-red-600"
                              : "hover:text-primary"
                          }`}
                        >
                          {a.active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <User className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm font-medium">Tidak ada akun yang cocok.</p>
          </div>
        )}
      </div>

      {/* Modal tambah / ubah akun */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold">
              {editingId !== null ? "Ubah Akun" : "Tambah Akun"}
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Nama lengkap
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  NIM / NIP
                </label>
                <input
                  value={form.code === "-" ? "" : form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Email kampus
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Peran
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as Role })
                    }
                    className={`${inputClass} bg-white`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Status
                  </label>
                  <select
                    value={form.active ? "1" : "0"}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.value === "1" })
                    }
                    className={`${inputClass} bg-white`}
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Nonaktif</option>
                  </select>
                </div>
              </div>
              {showError && (
                <p className="text-xs text-red-600">
                  Nama dan email wajib diisi.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

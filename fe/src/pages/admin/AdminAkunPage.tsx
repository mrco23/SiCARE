import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageContainer,
  PageHeader,
  SkeletonTable,
  useToast,
} from "../../components/shared";
import { useAuth } from "../../features/auth/useAuth";
import { adminApi } from "../../lib/adminApi";
import type {
  AccountStatusApi,
  AdminAccountDto,
  AdminAccountRecordDto,
  AppRoleApi,
  MemberCategoryApi,
} from "../../types/api";
import type { Role } from "../../types/admin";
import type { AdminAccountTab } from "../../features/admin/accounts/accountSelectors";
import {
  Loader2,
  RefreshCw,
  Search,
  SquarePen,
  User,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */

type Tab = AdminAccountTab;
type StatusFilter = "all" | AccountStatusApi;

type ManagedAccount = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  role: Role;
  appRole: AppRoleApi;
  memberCategory: MemberCategoryApi | null;
  status: AccountStatusApi;
  active: boolean;
  created: string;
};

type FormState = {
  name: string;
  code: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  status: AccountStatusApi;
};

const ROLES: Role[] = ["Konselor", "Kepala LMI"];
const TABS: Tab[] = ["Semua", "Konselor", "Klien", "Kepala LMI", "Admin"];

const ROLE_STYLE: Record<Role, string> = {
  Konselor: "bg-primary-subtle text-primary border-emerald-100",
  Mahasiswa: "bg-sky-50 text-sky-700 border-sky-100",
  Dosen: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Staff: "bg-teal-50 text-teal-700 border-teal-100",
  "Kepala LMI": "bg-violet-50 text-violet-700 border-violet-100",
  Admin: "bg-amber-50 text-amber-700 border-amber-100",
};

const STATUS_LABEL: Record<AccountStatusApi, string> = {
  active: "Aktif",
  pending: "Menunggu",
  disabled: "Nonaktif",
};

/* ========================= HELPER ========================= */
function mapDtoToUiRole(dto: AdminAccountRecordDto): Role {
  if (dto.app_role === "counselor") return "Konselor";
  if (dto.app_role === "head_lmi") return "Kepala LMI";
  if (dto.app_role === "admin") return "Admin";
  if (dto.member_category === "faculty_staff") return "Dosen";
  if (dto.member_category === "other") return "Staff";
  return "Mahasiswa";
}

function mapUiRoleToApi(role: Role): {
  app_role: "counselor" | "head_lmi";
  member_category: null;
} {
  if (role === "Kepala LMI") {
    return { app_role: "head_lmi", member_category: null };
  }
  return { app_role: "counselor", member_category: null };
}

function mapAccountDto(
  dto: AdminAccountDto | (AdminAccountRecordDto & { email?: string | null }),
  fallbackEmail = "-",
): ManagedAccount {
  const role = mapDtoToUiRole(dto);
  const resolvedEmail = dto.email ?? fallbackEmail;
  return {
    id: dto.id,
    name:
      dto.full_name?.trim() ||
      (resolvedEmail !== "-" ? resolvedEmail.split("@")[0] : "") ||
      "Tanpa Nama",
    code: dto.identity_code?.trim() || "-",
    email: resolvedEmail,
    phone: dto.phone_e164 ?? "",
    role,
    appRole: dto.app_role,
    memberCategory: dto.member_category,
    status: dto.account_status,
    active: dto.account_status === "active",
    created: dto.created_at,
  };
}

function matchesTab(account: ManagedAccount, tab: Tab): boolean {
  if (tab === "Semua") return true;
  if (tab === "Klien") return account.appRole === "client";
  if (tab === "Konselor") return account.appRole === "counselor";
  if (tab === "Kepala LMI") return account.appRole === "head_lmi";
  return account.appRole === "admin";
}

const initials = (n: string) =>
  n
    .split(" ")
    .filter((w) => w && /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "AK";

const fmtDate = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const defaultAccountRoleForCreation = (currentTab: Tab): Role => {
  if (currentTab === "Kepala LMI") return "Kepala LMI";
  return "Konselor";
};

const emptyForm = (currentTab: Tab): FormState => ({
  name: "",
  code: "",
  email: "",
  password: "",
  phone: "",
  role: defaultAccountRoleForCreation(currentTab),
  status: "active",
});

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/30";

/* ========================= HALAMAN ========================= */
export default function AdminAkunPage() {
  const { user: currentUser } = useAuth();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("Semua");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  // Modal tambah / ubah
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingAccount = useMemo(
    () => (editingId !== null ? accounts.find((a) => a.id === editingId) ?? null : null),
    [editingId, accounts],
  );
  const isEditingRestrictedAccount =
    editingAccount !== null &&
    (editingAccount.appRole === "client" || editingAccount.appRole === "admin");
  const [form, setForm] = useState<FormState>(emptyForm("Semua"));
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Per-row action state
  const [busyId, setBusyId] = useState<string | null>(null);

  const toast = useToast();

  const fetchAccounts = useCallback(async () => {
    const dtos = await adminApi.listAccounts({ limit: 100 });
    return dtos.map((dto) => mapAccountDto(dto));
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAccounts()
      .then((items) => {
        if (!active) return;
        setAccounts(items);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : "Daftar akun tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchAccounts]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await fetchAccounts();
      setAccounts(items);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Daftar akun tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => matchesTab(a, tab))
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, tab, statusFilter, query]);

  /* ===== MODAL ===== */
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(tab));
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = async (a: ManagedAccount) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      code: a.code === "-" ? "" : a.code,
      email: a.email,
      password: "",
      phone: a.phone,
      role: a.role,
      status: a.status,
    });
    setFormError("");
    setModalOpen(true);

    // Ambil detail terbaru dari server
    try {
      const latest = await adminApi.getAccount(a.id);
      const mapped = mapAccountDto(latest);
      setAccounts((prev) =>
        prev.map((item) => (item.id === a.id ? mapped : item)),
      );
      setForm({
        name: mapped.name,
        code: mapped.code === "-" ? "" : mapped.code,
        email: mapped.email,
        password: "",
        phone: mapped.phone,
        role: mapped.role,
        status: mapped.status,
      });
    } catch {
      // Tetap gunakan data baris jika gagal refresh detail
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const save = async () => {
    const name = form.name.trim();
    const code = form.code.trim();
    const email = form.email.trim();
    const password = form.password;
    const phone = form.phone.trim();

    if (!name || !email) {
      setFormError("Nama lengkap dan email wajib diisi.");
      return;
    }

    if (editingId === null && password.length < 8) {
      setFormError("Password akun baru minimal 8 karakter.");
      return;
    }

    if (phone && (phone.length < 8 || phone.length > 20)) {
      setFormError("Nomor telepon harus antara 8 hingga 20 karakter.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      if (editingId !== null) {
        if (isEditingRestrictedAccount) {
          const updated = await adminApi.updateAccount(editingId, {
            full_name: name,
            identity_code: code || null,
            member_category: editingAccount?.memberCategory ?? null,
            phone_e164: phone || null,
            account_status: form.status,
          });
          const mapped = mapAccountDto(updated, email);
          setAccounts((prev) =>
            prev.map((a) => (a.id === editingId ? mapped : a)),
          );
          setModalOpen(false);
          toast.success(`Akun ${mapped.name} diperbarui.`);
        } else {
          const { app_role, member_category } = mapUiRoleToApi(form.role);
          const updated = await adminApi.updateAccount(editingId, {
            full_name: name,
            identity_code: code || null,
            member_category,
            phone_e164: phone || null,
            app_role,
            account_status: form.status,
          });
          const mapped = mapAccountDto(updated, email);
          setAccounts((prev) =>
            prev.map((a) => (a.id === editingId ? mapped : a)),
          );
          setModalOpen(false);
          toast.success(`Akun ${mapped.name} diperbarui.`);
        }
      } else {
        const { app_role, member_category } = mapUiRoleToApi(form.role);
        const created = await adminApi.createAccount({
          email,
          password,
          full_name: name,
          identity_code: code || null,
          member_category,
          app_role,
          account_status: form.status,
        });
        const mapped = mapAccountDto(created, email);
        setAccounts((prev) => [...prev, mapped]);
        setModalOpen(false);
        toast.success(`Akun ${mapped.name} berhasil dibuat.`);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Perubahan akun tidak dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (account: ManagedAccount) => {
    if (account.id === currentUser?.id && account.active) {
      toast.error("Akun admin yang sedang digunakan tidak dapat dinonaktifkan.");
      return;
    }

    setBusyId(account.id);
    try {
      if (account.active) {
        await adminApi.deactivateAccount(account.id);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id
              ? { ...a, status: "disabled", active: false }
              : a,
          ),
        );
        toast.success(`Akun ${account.name} dinonaktifkan.`);
      } else {
        const updated = await adminApi.updateAccount(account.id, {
          account_status: "active",
        });
        const mapped = mapAccountDto(updated, account.email);
        setAccounts((prev) =>
          prev.map((a) => (a.id === account.id ? mapped : a)),
        );
        toast.success(`Akun ${mapped.name} diaktifkan.`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Status akun tidak dapat diubah.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer role="admin">
      <PageHeader
        title="Manajemen Akun"
        description="Kelola akun konselor, klien (mahasiswa, dosen, staff), kepala LMI, dan admin."
        actions={
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </button>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          {TABS.map((t) => {
            const n = accounts.filter((a) => matchesTab(a, t)).length;
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter status akun"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="pending">Menunggu verifikasi</option>
          <option value="disabled">Nonaktif</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, email, NIM, atau NIP..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <button
          type="button"
          onClick={openAdd}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
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

        {loading ? (
          <SkeletonTable bare rows={6} columns={5} label="Memuat daftar akun dari server..." />
        ) : rows.length > 0 ? (
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
                {rows.map((a) => {
                  const isBusy = busyId === a.id;
                  const isSelf = a.id === currentUser?.id;
                  return (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {initials(a.name)}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {a.name}
                              {isSelf && (
                                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  Anda
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {a.code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${ROLE_STYLE[a.role]}`}
                          >
                            {a.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            a.status === "active"
                              ? "text-primary"
                              : a.status === "pending"
                                ? "text-amber-600"
                                : "text-slate-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              a.status === "active"
                                ? "bg-brand-accent"
                                : a.status === "pending"
                                  ? "bg-amber-400"
                                  : "bg-slate-300"
                            }`}
                          />
                          {STATUS_LABEL[a.status]}
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
                            disabled={isBusy}
                            onClick={() => void openEdit(a)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary disabled:opacity-40"
                          >
                            <SquarePen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || (isSelf && a.active)}
                            title={
                              isSelf && a.active
                                ? "Akun admin yang sedang aktif tidak dapat menonaktifkan diri sendiri"
                                : a.active
                                  ? "Nonaktifkan"
                                  : "Aktifkan"
                            }
                            onClick={() => void toggleActive(a)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 ${
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
                  );
                })}
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
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  NIM / NIP (opsional)
                </label>
                <input
                  value={form.code}
                  disabled={submitting}
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
                  readOnly={editingId !== null}
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${inputClass} ${
                    editingId !== null
                      ? "cursor-not-allowed bg-slate-50 text-slate-500"
                      : ""
                  }`}
                />
              </div>
              {editingId === null ? (
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Password awal (minimal 8 karakter)
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    disabled={submitting}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Minimal 8 karakter"
                    className={inputClass}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Nomor telepon (opsional)
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    disabled={submitting}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="Contoh: +6281234567890"
                    className={inputClass}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Peran
                  </label>
                  {isEditingRestrictedAccount ? (
                    <div>
                      <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold ${ROLE_STYLE[form.role]}`}
                        >
                          {form.role}
                        </span>
                        <span className="text-xs text-slate-500">
                          {editingAccount?.appRole === "admin" ? "Admin" : "Klien"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-amber-700">
                        Role akun ini tidak dapat diubah dari halaman admin.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={form.role}
                      disabled={submitting}
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
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Status
                  </label>
                  <select
                    value={form.status}
                    disabled={submitting}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as AccountStatusApi,
                      })
                    }
                    className={`${inputClass} bg-white`}
                  >
                    <option value="active">Aktif</option>
                    <option value="pending">Menunggu</option>
                    <option value="disabled">Nonaktif</option>
                  </select>
                </div>
              </div>
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600"
                >
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={closeModal}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
}

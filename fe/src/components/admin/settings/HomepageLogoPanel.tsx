import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImageUp, Loader2, Save, Shapes } from "lucide-react";
import { SettingsField as Field, SettingsPanel as Panel, useToast } from "../../shared";
import { adminApi } from "../../../lib/adminApi";
import type { HomepageLogoDto } from "../../../types/api";

const MAX_BYTES = 1024 * 1024;
const ACCEPTED = ["image/png", "image/webp"];
const DEFAULT_ALT = "Logo Lasallian DNA";

/**
 * Kelola logo Lasallian DNA di home page (menggantikan logo HIMPSI).
 * Satu logo aktif; admin hanya dapat mengganti (tidak ada hapus). PNG/WebP, maksimal 1 MB.
 */
export default function HomepageLogoPanel() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<HomepageLogoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [altText, setAltText] = useState(DEFAULT_ALT);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi
      .getHomepageLogo()
      .then((data) => {
        if (!active) return;
        setLogo(data);
        setAltText(data?.alt_text ?? DEFAULT_ALT);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Logo tidak dapat dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setFileError("Format logo harus PNG atau WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("Ukuran logo maksimal 1 MB.");
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => setPendingImage(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setFileError("File logo tidak dapat dibaca.");
    reader.readAsDataURL(file);
  };

  const trimmedAlt = altText.trim();
  const altError = !trimmedAlt ? "Keterangan logo wajib diisi." : trimmedAlt.length > 120 ? "Maksimal 120 karakter." : "";
  const dirty = Boolean(pendingImage) || (logo !== null && trimmedAlt !== logo.alt_text);
  const canSave = !saving && !altError && (pendingImage !== null || (logo !== null && dirty));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateHomepageLogo({
        alt_text: trimmedAlt,
        ...(pendingImage ? { image_data: pendingImage } : {}),
      });
      setLogo(updated);
      setAltText(updated.alt_text);
      setPendingImage(null);
      toast.success("Logo Lasallian DNA berhasil diperbarui.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo tidak dapat disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = pendingImage ?? logo?.url ?? null;

  return (
    <Panel
      className="lg:col-span-2"
      icon={<Shapes className="h-5 w-5" />}
      title="Logo Lasallian DNA"
      description="Logo ini tampil di beranda di samping logo kampus. Ganti setiap tahun sesuai logo Lasallian DNA terbaru."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat logo...
        </div>
      ) : loadError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-800">Tampilan di beranda</p>
            <div className="flex min-h-28 items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-[#f5fdf9] px-4 py-5">
              <img src="/kampus.png" alt="Logo kampus" className="h-16 w-auto object-contain md:h-20" />
              {previewSrc ? (
                <img src={previewSrc} alt={trimmedAlt || DEFAULT_ALT} className="h-16 w-auto max-w-[260px] object-contain md:h-20" />
              ) : (
                <span className="text-xs text-gray-500">Belum ada logo. Beranda masih menampilkan logo lama.</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Tinggi logo otomatis disamakan dengan logo kampus; lebarnya mengikuti proporsi gambar.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="File logo" error={fileError}>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/webp"
                className="hidden"
                onChange={onPickFile}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <ImageUp className="h-4 w-4" />
                {logo || pendingImage ? "Pilih logo pengganti" : "Pilih logo"}
              </button>
              <p className="mt-1.5 text-xs text-gray-500">
                PNG atau WebP, maksimal 1 MB. Logo lama akan diganti dan tidak disimpan.
                {pendingImage && " Logo baru belum tersimpan."}
              </p>
            </Field>

            <Field label="Keterangan logo" required error={altError}>
              <input
                value={altText}
                maxLength={120}
                disabled={saving}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Contoh: Logo Lasallian DNA 2026/2027"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              <p className="mt-1.5 text-xs text-gray-500">Dipakai sebagai teks alternatif gambar untuk pembaca layar.</p>
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan logo
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

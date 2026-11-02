import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2, MailCheck, ArrowRight } from "lucide-react";
import CenteredAuthLayout from "../../components/auth/CenteredAuthLayout";
import { TextInput } from "../../components/auth/FormControls";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../features/auth/useAuth";

export default function AuthConfirmedPage() {
  const navigate = useNavigate();
  const { resendConfirmation } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // Resend form states
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    let active = true;

    async function processVerification() {
      if (!isSupabaseConfigured()) {
        if (!active) return;
        setStatus("error");
        setErrorMessage("Konfigurasi Supabase frontend belum tersedia.");
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // 1. Periksa parameter error dari Supabase Auth
      const errorParam = searchParams.get("error") || hashParams.get("error");
      const errorDesc = searchParams.get("error_description") || hashParams.get("error_description");
      if (errorParam || errorDesc) {
        if (!active) return;
        let friendlyMessage = errorDesc || "Tautan konfirmasi tidak valid atau sudah kedaluwarsa.";
        if (/expired|invalid|token/i.test(friendlyMessage)) {
          friendlyMessage = "Tautan verifikasi email tidak valid atau sudah kedaluwarsa. Silakan minta tautan verifikasi baru.";
        }
        setStatus("error");
        setErrorMessage(friendlyMessage);
        return;
      }

      const client = getSupabaseClient();

      try {
        // 2. PKCE flow: cek parameter `code`
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          window.history.replaceState(null, "", window.location.pathname);
          // Bersihkan sesi lokal agar tidak terjadi auto-redirect dan pengguna login secara eksplisit
          await client.auth.signOut({ scope: "local" }).catch(() => null);

          if (!active) return;
          setStatus("success");
          return;
        }

        // 3. OTP Token Hash flow: cek parameter `token_hash`
        const tokenHash = searchParams.get("token_hash");
        if (tokenHash) {
          const otpType = (searchParams.get("type") as "signup" | "email") || "signup";
          const { error: otpError } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (otpError) throw otpError;

          window.history.replaceState(null, "", window.location.pathname);
          await client.auth.signOut({ scope: "local" }).catch(() => null);

          if (!active) return;
          setStatus("success");
          return;
        }

        // 4. Implicit flow: cek `access_token` & `refresh_token` pada hash fragment
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;

          window.history.replaceState(null, "", window.location.pathname);
          await client.auth.signOut({ scope: "local" }).catch(() => null);

          if (!active) return;
          setStatus("success");
          return;
        }

        // 5. Cek apakah Supabase Auth client sudah sempat memproses sesi URL di latar belakang
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session?.user) {
          window.history.replaceState(null, "", window.location.pathname);
          await client.auth.signOut({ scope: "local" }).catch(() => null);

          if (!active) return;
          setStatus("success");
          return;
        }

        // 6. Tidak ada parameter token yang terdeteksi
        if (!active) return;
        setStatus("error");
        setErrorMessage(
          "Tautan verifikasi tidak ditemukan. Pastikan Anda membuka tautan langsung dari email konfirmasi yang dikirimkan.",
        );
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memverifikasi akun Anda. Silakan coba kirim ulang verifikasi.",
        );
      }
    }

    void processVerification();

    return () => {
      active = false;
    };
  }, []);

  async function handleResend(event: FormEvent) {
    event.preventDefault();
    if (!resendEmail.trim()) {
      setResendError("Masukkan email atau NIM/NIP Anda terlebih dahulu.");
      return;
    }

    setResending(true);
    setResendError("");
    setResendSuccess("");
    try {
      const res = await resendConfirmation(resendEmail.trim());
      setResendSuccess(res.message || "Tautan verifikasi baru telah dikirimkan ke email Anda.");
      setCooldown(60);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Gagal mengirim ulang email verifikasi.");
    } finally {
      setResending(false);
    }
  }

  function handleGoToLogin() {
    navigate("/login", {
      replace: true,
      state: {
        notice: "Email berhasil diverifikasi! Silakan masuk ke akun SiCARE Anda.",
      },
    });
  }

  return (
    <CenteredAuthLayout
      title="Verifikasi Akun"
      subtitle="Konfirmasi pendaftaran email Anda pada SiCARE"
      footer={
        <div className="flex items-center justify-center gap-2">
          <span>Sudah memiliki akun aktif?</span>
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </div>
      }
    >
      <div className="py-2 text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">Memverifikasi Email Anda...</h2>
              <p className="text-xs text-text-muted">
                Mohon tunggu sejenak selagi kami memproses konfirmasi akun Anda.
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center justify-center space-y-5 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-sm">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Email Berhasil Diverifikasi!</h2>
              <p className="text-sm text-text-muted">
                Akun SiCARE Anda telah aktif dan siap digunakan. Silakan masuk untuk mengakses layanan bimbingan dan konseling.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoToLogin}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-button bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark"
            >
              <span>Masuk ke SiCARE</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center space-y-5 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm">
              <AlertCircle className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Verifikasi Tidak Berhasil</h2>
              <p className="text-sm text-red-700 bg-red-50 p-3 rounded-xl border border-red-100">
                {errorMessage}
              </p>
            </div>

            {/* Panel Kirim Ulang Verifikasi */}
            <form onSubmit={handleResend} className="w-full space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                <MailCheck className="h-4 w-4 text-primary" />
                <span>Kirim Ulang Tautan Verifikasi</span>
              </div>
              <p className="text-xs text-text-muted">
                Masukkan email kampus atau NIM/NIP Anda untuk menerima tautan verifikasi baru:
              </p>

              {resendSuccess && (
                <div className="rounded-lg bg-green-50 p-2.5 text-xs text-green-800">
                  {resendSuccess}
                </div>
              )}
              {resendError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                  {resendError}
                </div>
              )}

              <div className="flex gap-2">
                <TextInput
                  id="resendEmailConfirmed"
                  type="text"
                  placeholder="Email kampus atau NIM/NIP"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="text-xs"
                />
                <button
                  type="submit"
                  disabled={resending || cooldown > 0}
                  className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : cooldown > 0 ? (
                    `${cooldown}d`
                  ) : (
                    "Kirim"
                  )}
                </button>
              </div>
            </form>

            <Link
              to="/login"
              className="mt-2 text-xs font-medium text-text-muted hover:text-primary transition underline"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        )}
      </div>
    </CenteredAuthLayout>
  );
}


import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface SectionErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  onReset?: () => void;
  fallbackMessage?: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): SectionErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat memuat bagian ini.";
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(): void {
    // Sesuai AGENTS.md Bagian 3: Error boundary tidak boleh mencatat data pribadi
    // (nama, NIM, isi konseling) ke console atau layanan log eksternal.
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          aria-label={this.props.title || "Bagian gagal dimuat"}
          className="rounded-3xl border border-red-200 bg-red-50/70 p-6 text-sm text-red-800 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-900">
                {this.props.title ? `${this.props.title} gagal dimuat` : "Bagian ini gagal dimuat"}
              </h3>
              <p className="mt-1 text-xs text-red-700">
                {this.props.fallbackMessage ||
                  "Terjadi kendala saat menampilkan data pada bagian ini. Anda dapat mencoba memuat ulang."}
              </p>
              <button
                type="button"
                onClick={this.handleReset}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Muat ulang bagian ini
              </button>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;

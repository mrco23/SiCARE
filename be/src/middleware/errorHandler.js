export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;

  let status;
  if (error?.type === "entity.too.large") status = 413;
  else if (error instanceof SyntaxError && "body" in error) status = 400;
  else if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) status = error.status;
  else status = 500;

  const defaultCodeByStatus = {
    400: "INVALID_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    413: "PAYLOAD_TOO_LARGE",
    503: "SERVICE_UNAVAILABLE",
  };
  const code = error?.type === "entity.too.large"
    ? "PAYLOAD_TOO_LARGE"
    : error instanceof SyntaxError && "body" in error
      ? "INVALID_JSON"
      : error?.code ?? defaultCodeByStatus[status] ?? "INTERNAL_ERROR";
  const message = status === 413
    ? "Ukuran request melebihi batas yang diizinkan."
    : status === 400 && error instanceof SyntaxError && "body" in error
      ? "Format JSON tidak valid."
      : status === 500
        ? "Terjadi kesalahan pada server."
        : error?.message ?? "Permintaan tidak dapat diproses.";

  if (status >= 500) {
    // Do not log request bodies, authorization headers, tokens, or sensitive counseling data.
    console.error("API request failed", { name: error?.name ?? "Error", code });
  }

  const payload = { error: { code, message } };
  if (status < 500 && error?.details) payload.error.details = error.details;
  response.status(status).json(payload);
}

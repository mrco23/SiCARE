export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function requireData(data, message = "Data tidak ditemukan.") {
  if (!data) throw new HttpError(404, "NOT_FOUND", message);
  return data;
}

export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Data request tidak valid.",
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return result.data;
}

export function sendData(response, data, status = 200) {
  return response.status(status).json({ data });
}

export function supabaseError(error, fallback = "Operasi database gagal.") {
  if (!error) return;
  if (error.code === "23505") throw new HttpError(409, "CONFLICT", "Data duplikat atau slot sudah dipesan.");
  if (["23503", "23514", "22P02"].includes(error.code)) {
    throw new HttpError(400, "INVALID_DATA", "Data tidak memenuhi aturan database.");
  }
  if (error.code === "PGRST116") throw new HttpError(404, "NOT_FOUND", "Data tidak ditemukan.");
  throw new HttpError(500, "DATABASE_ERROR", fallback);
}

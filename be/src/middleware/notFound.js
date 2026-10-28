export function notFoundHandler(_request, response) {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Endpoint tidak ditemukan.",
    },
  });
}

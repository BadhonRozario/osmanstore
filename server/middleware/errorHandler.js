export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === 'ValidationError' || err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: status === 500 ? 'Internal server error' : err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 3 MB or smaller.' : err.message });
}

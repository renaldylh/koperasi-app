/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  const message = err.message || 'Terjadi kesalahan server.';
  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Bungkus async route handler agar error tertangkap otomatis
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };

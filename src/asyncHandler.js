// Express 4 does not automatically catch rejected Promises from async route
// handlers — an unhandled rejection there just leaves the HTTP request open
// forever instead of sending an error response. Wrap every async handler
// with this so failures (e.g. Redis errors) always produce a real response.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export async function loggerMiddleware(req, res, next) {
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} ${res.statusCode}`);
    next();
}

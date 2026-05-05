const http = require("http");

/**
 * @param {import("express").Express} app
 * @param {(port: number) => Promise<void>} fn
 */
function withServer(app, fn) {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      try {
        await fn(port);
      } catch (e) {
        server.close(() => reject(e));
        return;
      }
      server.close((err) => (err ? reject(err) : resolve()));
    });
    server.on("error", reject);
  });
}

/**
 * @param {number} port
 * @param {{ method?: string, path: string, body?: unknown, token?: string }} opts
 */
async function jsonRequest(port, opts) {
  const method = opts.method || "GET";
  const headers = { Accept: "application/json" };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const res = await fetch(`http://127.0.0.1:${port}${opts.path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

module.exports = { withServer, jsonRequest };

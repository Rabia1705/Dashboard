const http = require("http");
const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 8080;
const root = path.join(__dirname, "..", "docs");
const dataRoot = path.join(__dirname, "..", "data");

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html";
    case ".css": return "text/css";
    case ".js": return "application/javascript";
    case ".json": return "application/json";
    case ".md": return "text/markdown";
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".xls": return "application/vnd.ms-excel";
    default: return "application/octet-stream";
  }
}

http.createServer((req, res) => {
  const normalizedPath = decodeURIComponent(req.url.split("?")[0]).replace(/\/+$/, "") || "/";
  const isDataRequest = normalizedPath.startsWith("/data/");
  const base = isDataRequest ? dataRoot : root;
  const relativePath = isDataRequest ? normalizedPath.slice("/data/".length) : (normalizedPath === "/" ? "index.html" : normalizedPath);
  let filePath = path.join(base, relativePath);

  if (!filePath.startsWith(base)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        res.end("Server error");
        return;
      }

      res.writeHead(200, { "Content-Type": getContentType(filePath) });
      res.end(data);
    });
  });
}).listen(port, () => {
  console.log(`Docs server running at http://localhost:${port}`);
});

const http = require("http");
const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 8080;
const root = path.join(__dirname, "..", "docs");

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
    default: return "application/octet-stream";
  }
}

http.createServer((req, res) => {
  const normalizedPath = req.url.split("?")[0].replace(/\/+$/, "") || "/";
  let filePath = path.join(root, normalizedPath === "/" ? "index.html" : normalizedPath);

  if (!filePath.startsWith(root)) {
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

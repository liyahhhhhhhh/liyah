const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "access.log");

function getClientIP(req) {
    const forwarded = req.headers["x-forwarded-for"];

    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    return req.socket.remoteAddress || "unknown";
}

function logVisit(req) {
    const timestamp = new Date().toISOString();
    const ip = getClientIP(req);
    const userAgent = req.headers["user-agent"] || "unknown";
    const entry =
        `[${timestamp}] IP=${ip} PATH=${req.url} USER_AGENT=${userAgent}\n`;

    fs.appendFileSync(LOG_FILE, entry);
    console.log(entry.trim());
}

const server = http.createServer((req, res) => {
    logVisit(req);

    let requestedPath = req.url.split("?")[0];

    if (requestedPath === "/") {
        requestedPath = "/index.html";
    }

    const filePath = path.join(__dirname, requestedPath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, {
                "Content-Type": "text/plain"
            });

            res.end("404 - Not Found");
            return;
        }

        let contentType = "text/html";

        if (filePath.endsWith(".css")) {
            contentType = "text/css";
        } else if (filePath.endsWith(".js")) {
            contentType = "application/javascript";
        } else if (filePath.endsWith(".jpeg") || filePath.endsWith(".jpg")) {
            contentType = "image/jpeg";
        } else if (filePath.endsWith(".png")) {
            contentType = "image/png";
        } else if (filePath.endsWith(".otf")) {
            contentType = "font/otf";
        }

        res.writeHead(200, {
            "Content-Type": contentType
        });

        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

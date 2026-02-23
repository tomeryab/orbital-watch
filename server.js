const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8787;

function isValidIPv4(ip) {
  if (typeof ip !== "string") return false;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function pingOnce(ip, timeoutMs = 100) {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";

    // Windows: ping -n 1 -w <ms> <ip>
    // Linux:   ping -c 1 -W <sec> <ip>
    // macOS:   ping -c 1 -W <ms or sec depending> (we’ll accept either; usually OK)
    const args = isWin
      ? ["-n", "1", "-w", String(timeoutMs), ip]
      : ["-c", "1", "-W", String(Math.ceil(timeoutMs / 1000)), ip];

    const start = Date.now();
    execFile("ping", args, { timeout: timeoutMs + 500 }, (err) => {
      const rttMs = Date.now() - start;
      resolve({ reachable: !err, rttMs: !err ? rttMs : null });
    });
  });
}

app.get("/health", (_req, res) => res.json({ ok: true }));

// Example: GET http://localhost:8787/jbox/status?ip=192.168.168.55
app.get("/jbox/status", async (req, res) => {
  const ip = (req.query.ip || "").toString().trim();
  if (!isValidIPv4(ip)) {
    return res.status(400).json({ ok: false, error: "Invalid IPv4 address" });
  }

  const result = await pingOnce(ip, 1500);
  res.json({ ok: true, ip, ...result });
});

app.listen(PORT, () => {
  console.log(`JBOX checker running: http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/jbox/status?ip=192.168.168.55`);
});	
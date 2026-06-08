const https = require("https")
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const BIN_DIR = path.join(__dirname, "..", "bin")
const PLAT = process.platform
const isWin = PLAT === "win32"

const URL = isWin
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"

const DEST = path.join(BIN_DIR, isWin ? "yt-dlp.exe" : "yt-dlp")

if (fs.existsSync(DEST)) {
  console.log("yt-dlp binary already exists at", DEST)
  process.exit(0)
}

console.log("Downloading yt-dlp from", URL)
const file = fs.createWriteStream(DEST)
https.get(URL, (res) => {
  if (res.statusCode === 302 || res.statusCode === 301) {
    https.get(res.headers.location, (r) => r.pipe(file))
  } else {
    res.pipe(file)
  }
  file.on("finish", () => {
    file.close()
    if (!isWin) {
      try { execSync(`chmod +x "${DEST}"`) } catch {}
    }
    console.log("yt-dlp downloaded to", DEST)
  })
}).on("error", (err) => {
  fs.unlinkSync(DEST)
  console.error("Download failed:", err.message)
  process.exit(1)
})

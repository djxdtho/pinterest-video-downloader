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

if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true })

console.log("Downloading yt-dlp from", URL)

// axios follows redirects automatically
const axios = require("axios")

async function main() {
  const resp = await axios({ method: "GET", url: URL, responseType: "stream", timeout: 60000 })
  const writer = fs.createWriteStream(DEST)
  resp.data.pipe(writer)
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve)
    writer.on("error", reject)
  })
  if (!isWin) {
    try { execSync(`chmod +x "${DEST}"`) } catch {}
  }
  console.log("yt-dlp downloaded to", DEST)
}

main().catch((err) => {
  console.error("Download failed:", err.message)
  if (fs.existsSync(DEST)) fs.unlinkSync(DEST)
  process.exit(1)
})

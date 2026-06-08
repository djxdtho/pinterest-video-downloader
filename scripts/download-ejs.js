const fs = require("fs")
const path = require("path")
const axios = require("axios")

const EJS_DIR = path.join(__dirname, "..", "ejs")
const EJS_VERSION = "0.8.0"
const BASE = `https://github.com/yt-dlp/ejs/releases/download/${EJS_VERSION}`

const FILES = [
  { name: "yt.solver.core.min.js", key: "core" },
  { name: "yt.solver.lib.min.js", key: "lib" },
]

async function main() {
  if (fs.existsSync(path.join(EJS_DIR, ".download-complete"))) {
    console.log("EJS scripts already downloaded")
    return
  }

  if (!fs.existsSync(EJS_DIR)) fs.mkdirSync(EJS_DIR, { recursive: true })

  for (const { name, key } of FILES) {
    const url = `${BASE}/${name}`
    const dest = path.join(EJS_DIR, name)
    console.log("Downloading", url)
    const resp = await axios({ method: "GET", url, responseType: "text", timeout: 30000 })
    fs.writeFileSync(dest, resp.data)
    console.log(`  -> saved ${dest} (${resp.data.length} bytes)`)
  }

  const ytdlpVersion = process.env.YTDLP_VERSION || "2026.03.17"
  for (const { name, key } of FILES) {
    const jsPath = path.join(EJS_DIR, name)
    const code = fs.readFileSync(jsPath, "utf8")
    const cacheData = {
      "yt-dlp_version": ytdlpVersion,
      "data": {
        "version": EJS_VERSION,
        "variant": "minified",
        "code": code,
      },
    }
    const cachePath = path.join(EJS_DIR, `${key}.json`)
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2))
    console.log(`  -> created cache ${cachePath}`)
  }

  fs.writeFileSync(path.join(EJS_DIR, ".download-complete"), EJS_VERSION)
  console.log("All EJS scripts downloaded and cache files created")
}

main().catch((err) => {
  console.error("EJS download failed:", err.message)
  process.exit(1)
})

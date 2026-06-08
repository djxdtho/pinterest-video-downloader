const express = require("express")
const path = require("path")
const axios = require("axios")
const cheerio = require("cheerio")
const { Innertube } = require("youtubei.js")

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

const AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
]

function shuffleAgent() { return AGENTS[Math.floor(Math.random() * AGENTS.length)] }

function vidId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

let _yt = null
async function yt() {
  if (!_yt) _yt = await Innertube.create({ retrieve_player: false })
  return _yt
}

// ─── YouTube ──────────────────────────────────────────────────────────

async function handleYouTube(url, quality) {
  const id = vidId(url)
  if (!id) throw new Error("Invalid YouTube URL")
  const info = await (await yt()).getInfo(id)
  const fmt = info.chooseFormat({ type: "videoandaudio", quality: quality === "2160p" ? "2160p" : "1080p" })

  return {
    title: info.basic_info.title || "YouTube Video",
    source: "youtube",
    qualityLabel: `${fmt?.height || 0}p`,
    width: fmt?.width || null,
    height: fmt?.height || null,
    hasAudio: true,
  }
}

// ─── Pinterest ────────────────────────────────────────────────────────

async function fetchPage(url) {
  return axios.get(url, {
    headers: {
      "User-Agent": shuffleAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.pinterest.com/",
      DNT: "1",
    },
    timeout: 15000,
    decompress: true,
  })
}

function extractFromHtml(html) {
  const patterns = [
    /"videoUrl"\s*:\s*"(https:[^"]+?\.mp4[^"]*)"/,
    /"contentUrl"\s*:\s*"(https:[^"]+?\.mp4[^"]*)"/,
    /"url"\s*:\s*"(https:[^"]+?\.mp4[^"]*)"/,
    /"video_url"\s*:\s*"(https:[^"]+?\.mp4[^"]*)"/,
    /<video[^>]*>[\s\S]*?<source[^>]*src="(https:[^"]+?\.mp4[^"]*)"[\s\S]*?<\/video>/i,
    /<video[^>]*src="(https:[^"]+?\.mp4[^"]*)"[^>]*>/i,
    /https?:\/\/v\.pinimg\.com\/videos\/[^"'\s]+\.mp4[^"'\s]*/,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) {
      let u = m[1] || m[0]
      u = u.replace(/\\u002F/g, "/").replace(/\\/g, "").split('"')[0].split("'")[0]
      if (u.startsWith("http")) return u
    }
  }
  return null
}

function extractFromJSON(html) {
  const $ = cheerio.load(html)
  let r = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (r) return
    try {
      const j = JSON.parse($(el).html() || "{}")
      const v = j.video
      if (v?.contentUrl) r = v.contentUrl.replace(/\\u002F/g, "/")
      else if (v?.url) r = v.url.replace(/\\u002F/g, "/")
    } catch {}
  })
  return r
}

function extractFromMeta(html) {
  const $ = cheerio.load(html)
  return $('meta[property="og:video"]').attr("content") ||
    $('meta[property="og:video:url"]').attr("content") ||
    $('meta[name="twitter:player"]').attr("content") || null
}

function extractTitle(html) {
  const $ = cheerio.load(html)
  return $('meta[property="og:title"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    $("title").text() || "Pinterest Video"
}

async function handlePinterest(url) {
  const resp = await fetchPage(url)
  const html = resp.data
  const videoUrl = extractFromJSON(html) || extractFromMeta(html) || extractFromHtml(html)
  if (!videoUrl) throw new Error("Could not find a video on this pin page.")
  return { videoUrl, title: extractTitle(html), source: "pinterest" }
}

// ─── URL detection ────────────────────────────────────────────────────

function detectSource(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube"
  if (/pinterest\.com|pin\.it/.test(url)) return "pinterest"
  return null
}

// ─── Routes ───────────────────────────────────────────────────────────

app.post("/api/extract", async (req, res) => {
  const { url, quality } = req.body
  if (!url) return res.status(400).json({ error: "Please enter a URL" })

  const source = detectSource(url)
  if (!source) return res.status(400).json({ error: "Unsupported link.", source: null })

  try {
    if (source === "youtube") return res.json(await handleYouTube(url, quality))
    if (source === "pinterest") return res.json(await handlePinterest(url))
  } catch (err) {
    const msg = err.message || ""
    if (msg.includes("Video unavailable") || msg.includes("Private video"))
      return res.status(403).json({ error: "This video is private or unavailable." })
    return res.status(500).json({ error: msg || "Something went wrong." })
  }
})

// Stream YouTube video using youtubei.js
app.get("/api/stream", async (req, res) => {
  const { url, quality, title } = req.query
  if (!url) return res.status(400).json({ error: "Missing url" })

  const id = vidId(url)
  if (!id) return res.status(400).json({ error: "Invalid YouTube URL" })

  const fname = (title || "video").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50)

  res.setHeader("Content-Type", "video/mp4")
  res.setHeader("Content-Disposition", `attachment; filename="${fname}.mp4"`)
  res.setHeader("Accept-Ranges", "bytes")

  try {
    const info = await (await yt()).getInfo(id)
    const stream = await info.download({
      type: "videoandaudio",
      quality: quality === "2160p" ? "2160p" : "1080p",
    })
    stream.pipe(res)
    req.on("close", () => { stream.destroy() })
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// Proxy Pinterest videos through server
app.get("/api/proxy", async (req, res) => {
  const { url: target, title } = req.query
  if (!target) return res.status(400).json({ error: "Missing url" })

  try {
    const resp = await axios({
      method: "GET",
      url: target,
      responseType: "stream",
      timeout: 30000,
      headers: { "User-Agent": shuffleAgent() },
    })

    const ct = resp.headers["content-type"] || "video/mp4"
    res.setHeader("Content-Type", ct)
    res.setHeader("Accept-Ranges", "bytes")

    const fname = (title || "video").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50)
    const ext = ct.includes("webm") ? "webm" : "mp4"
    res.setHeader("Content-Disposition", `attachment; filename="${fname}.${ext}"`)

    resp.data.pipe(res)
  } catch {
    if (!res.headersSent) res.status(502).json({ error: "Failed to fetch video stream." })
  }
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  })
}

module.exports = app

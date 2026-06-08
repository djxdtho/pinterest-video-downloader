const urlInput = document.getElementById("urlInput")
const pasteBtn = document.getElementById("pasteBtn")
const downloadBtn = document.getElementById("downloadBtn")
const errorMsg = document.getElementById("errorMsg")
const result = document.getElementById("result")
const videoPreview = document.getElementById("videoPreview")
const videoTitle = document.getElementById("videoTitle")
const saveBtn = document.getElementById("saveBtn")
const saveAudioBtn = document.getElementById("saveAudioBtn")
const placeholder = document.getElementById("placeholder")
const qualityRow = document.getElementById("qualityRow")
const qualityBtns = document.querySelectorAll(".quality-btn")
const sourceTabs = document.querySelectorAll(".source-tab")
const metaSource = document.getElementById("metaSource")
const metaQuality = document.getElementById("metaQuality")
const metaResolution = document.getElementById("metaResolution")

let selectedQuality = "1080p"
let activeSource = "all"

qualityBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    qualityBtns.forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")
    selectedQuality = btn.dataset.quality
  })
})

sourceTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    sourceTabs.forEach((t) => t.classList.remove("active"))
    tab.classList.add("active")
    activeSource = tab.dataset.source
    const placeholderText = activeSource === "youtube"
      ? "https://youtube.com/watch?v=..."
      : activeSource === "pinterest"
        ? "https://pin.it/..."
        : "https://pin.it/... or https://youtube.com/..."
    urlInput.placeholder = placeholderText
    errorMsg.textContent = ""
  })
})

urlInput.addEventListener("input", () => {
  const url = urlInput.value.trim()
  const isYoutube = /youtube\.com|youtu\.be/.test(url)
  qualityRow.classList.toggle("hidden", !isYoutube)
  errorMsg.textContent = ""
})

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText()
    urlInput.value = text
    urlInput.dispatchEvent(new Event("input"))
    errorMsg.textContent = ""
  } catch {
    errorMsg.textContent = "Could not read clipboard. Paste manually."
  }
})

downloadBtn.addEventListener("click", handleDownload)
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleDownload()
})

function setMeta(source, quality, width, height) {
  metaSource.textContent = source.charAt(0).toUpperCase() + source.slice(1)
  metaSource.className = "meta-source " + source

  if (quality) {
    metaQuality.textContent = quality
    metaQuality.style.display = "inline"
  } else {
    metaQuality.style.display = "none"
  }

  if (width && height) {
    metaResolution.textContent = `${width}×${height}`
    metaResolution.style.display = "inline"
  } else {
    metaResolution.style.display = "none"
  }
}

async function handleDownload() {
  const url = urlInput.value.trim()
  if (!url) {
    errorMsg.textContent = "Please enter a Pinterest or YouTube URL"
    return
  }

  const isPinterest = /pinterest\.com|pin\.it/.test(url)
  const isYoutube = /youtube\.com|youtu\.be/.test(url)

  if (!isPinterest && !isYoutube) {
    errorMsg.textContent = "Unsupported link. Paste a Pinterest or YouTube URL."
    return
  }

  errorMsg.textContent = ""
  downloadBtn.disabled = true
  downloadBtn.classList.add("loading")
  result.classList.add("hidden")
  saveAudioBtn.classList.add("hidden")

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, quality: isYoutube ? selectedQuality : undefined }),
    })

    const data = await res.json()

    if (!res.ok) {
      errorMsg.textContent = data.error || "Something went wrong"
      return
    }

    videoTitle.textContent = data.title || "Video"
    setMeta(data.source, data.qualityLabel, data.width, data.height)

    if (data.source === "youtube") {
      const streamUrl = `/api/stream?url=${encodeURIComponent(url)}&quality=${selectedQuality}&title=${encodeURIComponent(data.title || "video")}`
      videoPreview.src = streamUrl
      saveBtn.href = streamUrl
      saveBtn.download = (data.title || "video").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50) + ".mp4"
      saveAudioBtn.classList.add("hidden")
    } else {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(data.videoUrl)}&title=${encodeURIComponent(data.title || "video")}`
      videoPreview.src = proxyUrl
      saveBtn.href = proxyUrl
      saveBtn.download = (data.title || "pinterest-video").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50) + ".mp4"
      saveAudioBtn.classList.add("hidden")
    }

    videoPreview.load()
    result.classList.remove("hidden")
    placeholder.style.display = "none"
  } catch {
    errorMsg.textContent = "Network error. Check your connection."
  } finally {
    downloadBtn.disabled = false
    downloadBtn.classList.remove("loading")
  }
}

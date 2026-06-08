const urlInput = document.getElementById("urlInput")
const pasteBtn = document.getElementById("pasteBtn")
const downloadBtn = document.getElementById("downloadBtn")
const errorMsg = document.getElementById("errorMsg")
const result = document.getElementById("result")
const videoPreview = document.getElementById("videoPreview")
const videoTitle = document.getElementById("videoTitle")
const saveBtn = document.getElementById("saveBtn")
const placeholder = document.getElementById("placeholder")

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText()
    urlInput.value = text
    errorMsg.textContent = ""
  } catch {
    errorMsg.textContent = "Could not read clipboard. Paste manually."
  }
})

downloadBtn.addEventListener("click", handleDownload)
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleDownload()
})
urlInput.addEventListener("input", () => { errorMsg.textContent = "" })

async function handleDownload() {
  const url = urlInput.value.trim()
  if (!url) {
    errorMsg.textContent = "Please enter a Pinterest URL"
    return
  }

  if (!/pinterest\.(com|[a-z]{2}|co\.[a-z]{2})|pin\.it/.test(url)) {
    errorMsg.textContent = "Please enter a valid Pinterest link."
    return
  }

  errorMsg.textContent = ""
  downloadBtn.disabled = true
  downloadBtn.classList.add("loading")
  result.classList.add("hidden")

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()

    if (!res.ok) {
      errorMsg.textContent = data.error || "Something went wrong"
      return
    }

    videoTitle.textContent = data.title || "Video"

    const proxyUrl = `/api/proxy?url=${encodeURIComponent(data.videoUrl)}&title=${encodeURIComponent(data.title || "video")}`
    videoPreview.src = proxyUrl
    saveBtn.href = proxyUrl
    saveBtn.download = (data.title || "pinterest-video").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50) + ".mp4"

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

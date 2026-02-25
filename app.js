const video = document.getElementById("video");
const playlistEl = document.getElementById("playlist");
const metaEl = document.getElementById("meta");

let currentIndex = -1;
let items = [];
let fullscreenRequestedForPlayback = false;

async function loadPlaylist() {
  try {
    const res = await fetch("./assets/playlist.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`playlist.json の読み込みに失敗: ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data.files)) {
      throw new Error("playlist.json の files が配列ではありません");
    }

    items = data.files
      .map((file) => (typeof file === "string" ? { file } : file))
      .filter((entry) => /\.(mp4|mov)$/i.test(entry.file || ""));

    if (!items.length) {
      metaEl.textContent = "assets/playlist.json に mp4 / mov を追加してください。";
      return;
    }

    renderPlaylist();
    metaEl.textContent = "再生リストから動画を選択してください。";
  } catch (err) {
    console.error(err);
    metaEl.textContent = `エラー: ${err.message}`;
  }
}

function renderPlaylist() {
  playlistEl.innerHTML = "";

  items.forEach((entry, index) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "play-btn";
    btn.textContent = entry.title || entry.file;
    btn.addEventListener("click", () => {
      playByIndex(index, true).catch((err) => {
        console.error(err);
        metaEl.textContent = `再生エラー: ${err.message}`;
      });
    });
    li.appendChild(btn);
    playlistEl.appendChild(li);
  });
}

function updateActiveButton() {
  const buttons = playlistEl.querySelectorAll(".play-btn");
  buttons.forEach((btn, idx) => {
    btn.classList.toggle("active", idx === currentIndex);
  });
}

async function checkEfficiency(entry) {
  if (!("mediaCapabilities" in navigator)) return "";
  try {
    const normalizedType = normalizeContentType(entry.contentType, entry.file);
    const config = {
      type: "file",
      video: {
        contentType: normalizedType,
        width: entry.width || 1920,
        height: entry.height || 1080,
        bitrate: entry.bitrate || 8_000_000,
        framerate: entry.framerate || 30,
      },
    };

    const info = await navigator.mediaCapabilities.decodingInfo(config);
    if (!info.supported) return " / この設定は非対応";
    return info.powerEfficient ? " / 省電力デコード" : " / 高負荷デコード";
  } catch {
    return "";
  }
}

function normalizeContentType(contentType, file) {
  const fallback = guessContentType(file);
  if (typeof contentType !== "string" || contentType.trim() === "") return fallback;
  const normalized = contentType.replace(/codecs=([^";\s][^;\s]*)/i, 'codecs="$1"');
  if (!/^[^/]+\/[^;]+(?:;\s*codecs="[^"]+")?$/i.test(normalized)) return fallback;
  return normalized;
}

function guessContentType(file) {
  return /\.mov$/i.test(file) ? 'video/quicktime; codecs="hvc1"' : 'video/mp4; codecs="avc1.42E01E"';
}

async function playByIndex(index, autoplay) {
  if (index < 0 || index >= items.length) return;

  const entry = items[index];
  currentIndex = index;
  updateActiveButton();

  video.pause();
  const mediaPath = `./assets/${encodeURI(entry.file)}`;
  video.src = mediaPath;
  video.load();
  fullscreenRequestedForPlayback = false;

  const efficiencyText = await checkEfficiency(entry);
  metaEl.textContent = `読み込み中: ${entry.file}${efficiencyText}`;

  await once(video, "loadedmetadata");
  const details = `${Math.round(video.videoWidth)}x${Math.round(video.videoHeight)} / ${formatTime(video.duration)}${efficiencyText}`;
  metaEl.textContent = `${entry.title || entry.file} (${details})`;

  if (autoplay) {
    try {
      await video.play();
      await ensureFullscreen();
    } catch (err) {
      metaEl.textContent = `${entry.title || entry.file} を再生できませんでした。`;
      throw err;
    }
  }
}

async function ensureFullscreen() {
  if (fullscreenRequestedForPlayback) return;
  fullscreenRequestedForPlayback = true;

  try {
    if (document.fullscreenElement !== video && typeof video.requestFullscreen === "function") {
      await video.requestFullscreen();
      return;
    }
  } catch {
    // Fall through to iOS Safari fullscreen API.
  }

  try {
    if (typeof video.webkitEnterFullscreen === "function") {
      video.webkitEnterFullscreen();
    }
  } catch {
    // Ignore if fullscreen is blocked by browser policy.
  }
}

function once(target, eventName) {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      const code = target.error?.code;
      if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        reject(new Error("メディアの読み込みに失敗しました（ファイル未配置、または形式非対応）"));
        return;
      }
      reject(new Error("メディアの読み込みに失敗しました"));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onOk);
      target.removeEventListener("error", onErr);
    };

    target.addEventListener(eventName, onOk, { once: true });
    target.addEventListener("error", onErr, { once: true });
  });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function seekBy(deltaSeconds) {
  if (!Number.isFinite(video.duration)) return;
  const nextTime = Math.min(Math.max(video.currentTime + deltaSeconds, 0), video.duration);
  video.currentTime = nextTime;
}

video.addEventListener("ended", () => {
  const next = currentIndex + 1;
  if (next < items.length) {
    playByIndex(next, true).catch((err) => {
      console.error(err);
      metaEl.textContent = `連続再生エラー: ${err.message}`;
    });
  }
});

video.addEventListener("play", () => {
  ensureFullscreen().catch(() => {});
});

video.addEventListener("dblclick", () => {
  seekBy(5);
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTypingTarget =
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  if (isTypingTarget) return;

  if (event.key === "ArrowRight") {
    event.preventDefault();
    seekBy(5);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    seekBy(-5);
  }
});

loadPlaylist();

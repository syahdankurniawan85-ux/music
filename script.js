// NEONWAVE — music player demo. Ganti URL audio dengan file yang kamu punya izin untuk pakai.
const tracks = [
  { id: 1, title: "Midnight City Lights", artist: "Nova Echo", genre: "Synthwave", duration: "3:42", cover: "cover-1", initials: "NC", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "Ocean in Motion", artist: "Luna Pacific", genre: "Chill", duration: "4:12", cover: "cover-2", initials: "OP", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "Golden Hour", artist: "Sunday Club", genre: "Indie Pop", duration: "3:28", cover: "cover-3", initials: "GH", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: 4, title: "After the Rain", artist: "Velvet Static", genre: "Electronic", duration: "4:06", cover: "cover-4", initials: "AR", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id: 5, title: "Electric Bloom", artist: "Mira Sol", genre: "Dream Pop", duration: "3:51", cover: "cover-5", initials: "EB", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id: 6, title: "Soft Focus", artist: "The Blue Hours", genre: "Lo-fi", duration: "2:59", cover: "cover-6", initials: "SF", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  // Ganti judul/artis di bawah dengan metadata video yang sebenarnya jika sudah diketahui.
  { id: 7, title: "Lagu YouTube (ubah judul)", artist: "Nama artis (ubah)", genre: "YouTube", duration: "Video", cover: "cover-7", initials: "YT", youtubeId: "DeCO1sct6GI" }
];

const builtInTracks = [...tracks];
let customTracks = [];
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function extractYouTubeId(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const allowedHosts = new Set(["youtu.be", "youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"]);
  if (!allowedHosts.has(host)) return null;

  let videoId = null;
  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || null;
  } else {
    videoId = url.searchParams.get("v");
    if (!videoId) {
      const parts = url.pathname.split("/").filter(Boolean);
      const markerIndex = parts.findIndex(part => ["embed", "shorts", "live"].includes(part));
      if (markerIndex >= 0) videoId = parts[markerIndex + 1] || null;
    }
  }
  return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? videoId : null;
}

function applyCustomTracks(items) {
  const seen = new Set(builtInTracks.filter(track => track.youtubeId).map(track => track.youtubeId));
  const normalized = [];
  (Array.isArray(items) ? items : []).forEach(item => {
    if (!item || typeof item !== "object") return;
    const videoId = typeof item.youtubeId === "string" && YOUTUBE_ID_PATTERN.test(item.youtubeId) ? item.youtubeId : null;
    if (!videoId || seen.has(videoId)) return;
    seen.add(videoId);
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 100) : "";
    const artist = typeof item.artist === "string" ? item.artist.trim().slice(0, 80) : "";
    if (!title) return;
    normalized.push({
      id: `yt_${videoId}`,
      title,
      artist: artist || "YouTube",
      genre: "YouTube",
      duration: "Video",
      cover: "cover-7",
      initials: "YT",
      youtubeId: videoId,
      isCustomYouTube: true
    });
  });
  customTracks = normalized;
  tracks.splice(0, tracks.length, ...builtInTracks, ...customTracks);
}

const $ = (selector) => document.querySelector(selector);
const audio = $("#audio");
let currentTrackId = null;
let currentView = "discover";
let query = "";
let shuffle = false;
let repeat = false;
let toastTimer;
let supabaseClient = null;
let signedInUser = null;
let authMode = "login";
let cloudSaveTimer = null;
let cloudReady = false;
let applyingCloudData = false;
let youtubePlayer = null;
let youtubePlayerReady = false;
let youtubeApiPromise = null;
let youtubePlayerPromise = null;
let youtubeSyncTimer = null;
let youtubePlayRequest = 0;

function readFavorites() {
  try { return JSON.parse(localStorage.getItem("neonwave-favorites") || "[]"); }
  catch { return []; }
}
let favorites = readFavorites();

function readStored(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value == null ? fallback : value; }
  catch { return fallback; }
}
function makeId() { return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
let playlists = readStored("neonwave-playlists", []);
let queue = readStored("neonwave-queue", []);
let activePlaylistId = null;
let playlistTargetTrackId = null;
let queuePlaybackIds = [];
let queuePlaybackIndex = -1;
playlists = Array.isArray(playlists) ? playlists.filter(item => item && item.id && item.name && Array.isArray(item.trackIds)) : [];
queue = Array.isArray(queue) ? queue.filter(id => tracks.some(track => track.id === id)) : [];

function savePlaylists() {
  try { localStorage.setItem("neonwave-playlists", JSON.stringify(playlists)); }
  catch { showToast("Browser tidak bisa menyimpan playlist."); }
  $("#playlistCount").textContent = playlists.length;
  scheduleCloudSave();
}
function saveQueue() {
  try { localStorage.setItem("neonwave-queue", JSON.stringify(queue)); }
  catch { showToast("Browser tidak bisa menyimpan antrean."); }
  $("#queueCount").textContent = queue.length;
  scheduleCloudSave();
}
function saveFavorites() {
  try { localStorage.setItem("neonwave-favorites", JSON.stringify(favorites)); }
  catch { showToast("Browser tidak bisa menyimpan favorit."); }
  $("#favoriteCount").textContent = favorites.length;
  scheduleCloudSave();
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function filteredTracks() {
  const base = currentView === "favorites"
    ? tracks.filter(track => favorites.includes(track.id))
    : currentView === "playlists"
      ? tracks.filter(track => (playlists.find(playlist => playlist.id === activePlaylistId)?.trackIds || []).includes(track.id))
      : tracks;
  return base.filter(track => `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(query.toLowerCase()));
}
function renderPlaylists() {
  const host = $("#playlistCards");
  if (!host) return;
  host.innerHTML = "";
  playlists.forEach(playlist => {
    const card = document.createElement("article");
    card.className = `playlist-card${activePlaylistId === playlist.id ? " selected" : ""}`;
    const art = document.createElement("div"); art.className = "playlist-card-art"; art.textContent = "♫";
    const copy = document.createElement("div"); copy.className = "playlist-card-copy";
    const title = document.createElement("strong"); title.textContent = playlist.name;
    const meta = document.createElement("span"); meta.textContent = `${playlist.trackIds.length} lagu`;
    copy.append(title, meta);
    const actions = document.createElement("div"); actions.className = "playlist-card-actions";
    const open = document.createElement("button"); open.className = "secondary-button"; open.type = "button";
    open.textContent = activePlaylistId === playlist.id ? "Dipilih" : "Buka";
    open.addEventListener("click", () => { activePlaylistId = playlist.id; setView("playlists"); });
    const play = document.createElement("button"); play.className = "icon-button"; play.type = "button"; play.textContent = "▶"; play.title = "Putar playlist";
    play.addEventListener("click", () => {
      const ids = playlist.trackIds.filter(id => tracks.some(track => track.id === id));
      if (!ids.length) return showToast("Playlist ini masih kosong.");
      activePlaylistId = playlist.id;
      setView("playlists");
      queuePlaybackIds = ids; queuePlaybackIndex = 0; playTrack(ids[0]);
    });
    const remove = document.createElement("button"); remove.className = "icon-button"; remove.type = "button"; remove.textContent = "×"; remove.title = "Hapus playlist";
    remove.addEventListener("click", () => {
      if (!confirm(`Hapus playlist "${playlist.name}"? Lagu asli dan favorit tidak akan terhapus.`)) return;
      playlists = playlists.filter(item => item.id !== playlist.id);
      if (activePlaylistId === playlist.id) activePlaylistId = null;
      savePlaylists(); renderPlaylists(); renderTracks(); showToast("Playlist dihapus.");
    });
    actions.append(open, play, remove); card.append(art, copy, actions); host.appendChild(card);
  });
  $("#playlistCount").textContent = playlists.length;
}
function createPlaylist(name) {
  const clean = name.trim();
  if (!clean) return null;
  const existing = playlists.find(item => item.name.toLowerCase() === clean.toLowerCase());
  if (existing) { showToast("Nama playlist itu sudah ada."); return existing; }
  const playlist = { id: makeId(), name: clean, trackIds: [] };
  playlists.unshift(playlist); savePlaylists(); renderPlaylists(); showToast(`Playlist "${clean}" dibuat.`);
  return playlist;
}
function renderPlaylistChoices() {
  const host = $("#playlistChoices"); host.innerHTML = "";
  if (!playlists.length) {
    const empty = document.createElement("p"); empty.className = "muted small"; empty.textContent = "Belum ada playlist. Buat satu di bawah."; host.appendChild(empty); return;
  }
  playlists.forEach(playlist => {
    const button = document.createElement("button"); button.className = "playlist-choice"; button.type = "button";
    const name = document.createElement("strong"); name.textContent = playlist.name;
    const count = document.createElement("span"); count.textContent = `${playlist.trackIds.length} lagu`;
    button.append(name, count); button.addEventListener("click", () => addTrackToPlaylist(playlist.id, playlistTargetTrackId)); host.appendChild(button);
  });
}
function openPlaylistDialog(trackId) {
  const track = tracks.find(item => item.id === trackId); if (!track) return;
  playlistTargetTrackId = trackId; $("#playlistTrackLabel").textContent = `${track.title} — ${track.artist}`;
  $("#dialogPlaylistName").value = ""; renderPlaylistChoices(); $("#playlistDialog").showModal();
}
function addTrackToPlaylist(playlistId, trackId) {
  const playlist = playlists.find(item => item.id === playlistId); if (!playlist || !trackId) return;
  if (playlist.trackIds.includes(trackId)) showToast("Lagu ini sudah ada di playlist.");
  else { playlist.trackIds.push(trackId); savePlaylists(); renderPlaylists(); renderTracks(); showToast(`Ditambahkan ke "${playlist.name}".`); }
  $("#playlistDialog").close();
}
function addToQueue(trackId) {
  if (!tracks.some(track => track.id === trackId)) return;
  queue.push(trackId); saveQueue(); renderQueue(); showToast("Lagu ditambahkan ke antrean.");
}

async function addYouTubeTrack(event) {
  event.preventDefault();
  if (!signedInUser || !supabaseClient) {
    showToast("Masuk ke akun NEONWAVE dulu untuk menambahkan lagu.");
    return;
  }

  const videoId = extractYouTubeId($("#youtubeUrlInput").value);
  const title = $("#youtubeTitleInput").value.trim().slice(0, 100);
  const artist = $("#youtubeArtistInput").value.trim().slice(0, 80);
  const status = $("#youtubeAddStatus");
  status.textContent = "";

  if (!videoId) {
    status.textContent = "Link YouTube tidak valid. Gunakan link video, Shorts, atau youtu.be.";
    status.classList.add("error");
    return;
  }
  if (!title) {
    status.textContent = "Isi judul lagu atau video terlebih dahulu.";
    status.classList.add("error");
    return;
  }
  if (tracks.some(track => track.youtubeId === videoId)) {
    status.textContent = "Video ini sudah ada di katalog akunmu atau katalog bawaan.";
    status.classList.add("error");
    return;
  }

  const ownerId = signedInUser.id;
  const previousTracks = [...customTracks];
  applyCustomTracks([{
    id: `yt_${videoId}`,
    title,
    artist: artist || "YouTube",
    youtubeId: videoId
  }, ...customTracks]);
  renderTracks();

  const submit = $("#youtubeAddSubmit");
  submit.disabled = true;
  submit.textContent = "Menyimpan...";
  clearTimeout(cloudSaveTimer);
  const saved = await saveCloudData(ownerId);
  submit.disabled = false;
  submit.textContent = "＋ Tambahkan lagu";

  if (!saved) {
    if (signedInUser?.id === ownerId) applyCustomTracks(previousTracks);
    renderTracks();
    status.textContent = "Lagu belum tersimpan. Pastikan migrasi SQL custom_tracks sudah dijalankan, lalu coba lagi.";
    status.classList.add("error");
    return;
  }

  $("#youtubeAddForm").reset();
  $("#youtubeAddDialog").close();
  renderTracks();
  showToast("Lagu YouTube berhasil ditambahkan ke katalog akunmu.");
}

function renderQueue() {
  const host = $("#queueItems"); if (!host) return;
  host.innerHTML = ""; $("#queueCount").textContent = queue.length;
  const now = tracks.find(track => track.id === currentTrackId);
  $("#queueNow").textContent = now ? `Sedang diputar: ${now.title} — ${now.artist}` : "Belum ada lagu yang sedang diputar.";
  if (!queue.length) {
    const empty = document.createElement("p"); empty.className = "queue-empty";
    empty.textContent = "Antrean masih kosong. Tambahkan lagu lewat tombol + di daftar lagu."; host.appendChild(empty); return;
  }
  queue.forEach((trackId, index) => {
    const track = tracks.find(item => item.id === trackId); if (!track) return;
    const row = document.createElement("div"); row.className = "queue-row";
    const number = document.createElement("span"); number.className = "queue-index"; number.textContent = String(index + 1).padStart(2, "0");
    const info = document.createElement("div"); info.className = "queue-track-copy";
    const title = document.createElement("strong"); title.textContent = track.title;
    const artist = document.createElement("span"); artist.textContent = track.artist; info.append(title, artist);
    const makeButton = (label, titleText, handler, disabled = false) => {
      const button = document.createElement("button"); button.className = "icon-button"; button.type = "button";
      button.textContent = label; button.title = titleText; button.setAttribute("aria-label", titleText); button.disabled = disabled; button.addEventListener("click", handler); return button;
    };
    row.append(number, info,
      makeButton("▶", "Putar sekarang", () => { queue.splice(index, 1); saveQueue(); playTrack(track.id); renderQueue(); }),
      makeButton("↑", "Pindah ke atas", () => { [queue[index - 1], queue[index]] = [queue[index], queue[index - 1]]; saveQueue(); renderQueue(); }, index === 0),
      makeButton("↓", "Pindah ke bawah", () => { [queue[index + 1], queue[index]] = [queue[index], queue[index + 1]]; saveQueue(); renderQueue(); }, index === queue.length - 1),
      makeButton("×", "Hapus dari antrean", () => { queue.splice(index, 1); saveQueue(); renderQueue(); }));
    host.appendChild(row);
  });
}
function renderTracks() {
  const list = $("#trackList");
  const visibleTracks = filteredTracks();
  list.innerHTML = "";
  $("#emptyState").classList.toggle("hidden", visibleTracks.length > 0);
  $("#trackTotal").textContent = `${String(visibleTracks.length).padStart(2, "0")} TRACK${visibleTracks.length === 1 ? "" : "S"}`;
  const selectedPlaylist = playlists.find(item => item.id === activePlaylistId);
  $("#listHeading").innerHTML = currentView === "favorites" ? 'Your favorites <span class="heading-dot">.</span>' :
    currentView === "playlists" ? `${selectedPlaylist ? selectedPlaylist.name : "Pilih playlist"} <span class="heading-dot">.</span>` :
    'Trending tracks <span class="heading-dot">.</span>';
  $("#listEyebrow").textContent = currentView === "playlists" ? "YOUR COLLECTION" : currentView === "favorites" ? "SAVED TRACKS" : "CURATED FOR YOU";
  $("#playlistTools").classList.toggle("hidden", currentView !== "playlists");
  $("#emptyState").textContent = currentView === "playlists" && !selectedPlaylist
    ? "Pilih playlist di atas untuk melihat lagu, atau buat playlist baru."
    : currentView === "playlists" ? "Playlist ini masih kosong. Tambahkan lagu lewat tombol playlist pada daftar Discover."
    : "Belum ada lagu yang cocok. Coba kata pencarian lain.";

  visibleTracks.forEach((track, index) => {
    const isPlaying = currentTrackId === track.id && isPlaybackActive();
    const isCurrent = currentTrackId === track.id;
    const isFavorite = favorites.includes(track.id);
    const row = document.createElement("article");
    row.className = `track-row${isCurrent ? " is-playing" : ""}`;
    row.innerHTML = `
      <span class="track-number">${isPlaying ? "♫" : String(index + 1).padStart(2, "0")}</span>
      <div class="track-info">
        <div class="cover ${track.cover}"><span>${track.initials}</span></div>
        <div class="track-text"><strong></strong><span></span></div>
      </div>
      <span class="track-genre"></span>
      <span class="track-duration">${track.duration}</span>
      <div class="row-actions">
        <button class="row-play" aria-label="${isPlaying ? "Jeda" : "Putar"} ${track.title}" title="${isPlaying ? "Jeda" : "Putar"}">${isPlaying ? "Ⅱ" : "▶"}</button>
        <button class="row-heart ${isFavorite ? "favorited" : ""}" aria-label="${isFavorite ? "Hapus dari" : "Tambahkan ke"} favorit" title="${isFavorite ? "Hapus dari" : "Tambahkan ke"} favorit">${isFavorite ? "♥" : "♡"}</button>
        <button class="row-queue" aria-label="Tambahkan ${track.title} ke antrean" title="Tambahkan ke antrean">＋</button>
        <button class="row-playlist" aria-label="Tambahkan ${track.title} ke playlist" title="Tambahkan ke playlist">▤</button>
      </div>`;
    row.querySelector(".track-text strong").textContent = track.title;
    row.querySelector(".track-text span").textContent = track.artist;
    if (track.youtubeId) {
      const cover = row.querySelector(".cover");
      cover.style.backgroundImage = `url("https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg")`;
      cover.style.backgroundSize = "cover";
      cover.style.backgroundPosition = "center";
      cover.querySelector("span").textContent = "";
    }
    row.querySelector(".track-genre").textContent = track.genre;
    row.querySelector(".row-play").addEventListener("click", () => {
      if (currentTrackId === track.id && isPlaybackActive()) pauseTrack();
      else playTrack(track.id);
    });
    row.querySelector(".row-heart").addEventListener("click", () => toggleFavorite(track.id));
    row.querySelector(".row-queue").addEventListener("click", () => addToQueue(track.id));
    row.querySelector(".row-playlist").addEventListener("click", () => openPlaylistDialog(track.id));
    list.appendChild(row);
  });
}
function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#viewTitle").textContent = view === "favorites" ? "Favorites" : view === "playlists" ? "Playlists" : "Discover";
  if (view !== "playlists") activePlaylistId = null;
  renderPlaylists();
  renderTracks();
}
function isYouTubeTrack(track) {
  return Boolean(track && track.youtubeId);
}
function currentTrack() {
  return tracks.find(item => item.id === currentTrackId) || null;
}
function isPlaybackActive() {
  const track = currentTrack();
  if (!track) return false;
  if (isYouTubeTrack(track)) {
    return Boolean(youtubePlayerReady && window.YT && youtubePlayer &&
      youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING);
  }
  return !audio.paused;
}
function getYouTubeTime() {
  try { return youtubePlayerReady && youtubePlayer ? youtubePlayer.getCurrentTime() : 0; }
  catch { return 0; }
}
function getYouTubeDuration() {
  try { return youtubePlayerReady && youtubePlayer ? youtubePlayer.getDuration() : 0; }
  catch { return 0; }
}
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { if (typeof previousCallback === "function") previousCallback(); }
      finally { resolve(window.YT); }
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error("YouTube Player API gagal dimuat."));
    };
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}
async function ensureYouTubePlayer() {
  const YT = await loadYouTubeAPI();
  if (youtubePlayerReady && youtubePlayer) return youtubePlayer;
  if (youtubePlayerPromise) return youtubePlayerPromise;
  youtubePlayerPromise = new Promise(resolve => {
    youtubePlayer = new YT.Player("youtubePlayer", {
      width: "100%",
      height: "100%",
      videoId: "",
      playerVars: {
        controls: 1,
        enablejsapi: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: event => {
          youtubePlayerReady = true;
          resolve(event.target);
          updatePlayer();
        },
        onStateChange: handleYouTubeStateChange,
        onError: event => {
          const messages = {
            2: "ID video YouTube tidak valid.",
            5: "Browser gagal memutar video YouTube.",
            100: "Video tidak tersedia atau sudah dihapus.",
            101: "Pemilik video tidak mengizinkan pemutaran di website.",
            150: "Video ini tidak mengizinkan pemutaran melalui embed."
          };
          showToast(messages[event.data] || "Video YouTube tidak bisa diputar di website ini.");
        }
      }
    });
  });
  return youtubePlayerPromise;
}
function handleYouTubeStateChange(event) {
  if (!window.YT) return;
  const state = event.data;
  if (state === window.YT.PlayerState.PLAYING) {
    clearInterval(youtubeSyncTimer);
    youtubeSyncTimer = setInterval(() => updatePlayer(false), 500);
  } else {
    clearInterval(youtubeSyncTimer);
    youtubeSyncTimer = null;
    updatePlayer();
  }
  if (state === window.YT.PlayerState.ENDED) {
    if (repeat) {
      youtubePlayer.seekTo(0, true);
      youtubePlayer.playVideo();
    } else {
      playNext(1);
    }
  }
}

function updatePlayer(renderList = true) {
  const track = currentTrack();
  const youtubeTrack = isYouTubeTrack(track);
  const playing = isPlaybackActive();
  const currentTime = youtubeTrack ? getYouTubeTime() : audio.currentTime;
  const duration = youtubeTrack ? getYouTubeDuration() : audio.duration;
  $("#playButton").textContent = playing ? "Ⅱ" : "▶";
  $("#playButton").setAttribute("aria-label", playing ? "Jeda" : "Putar");
  $("#nowTitle").textContent = track ? track.title : "Pilih sebuah lagu";
  $("#nowArtist").textContent = track ? track.artist : "Your next favorite is waiting";
  $("#miniCover").innerHTML = `<span>${track && !track.youtubeId ? track.initials : track ? "" : "NW"}</span>`;
  $("#miniCover").className = `mini-cover${track ? " " + track.cover : ""}`;
  $("#miniCover").style.backgroundImage = track?.youtubeId
    ? `url("https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg")`
    : "";
  $("#miniCover").style.backgroundSize = "cover";
  $("#miniCover").style.backgroundPosition = "center";
  $("#favoriteNow").textContent = track && favorites.includes(track.id) ? "♥" : "♡";
  $("#favoriteNow").classList.toggle("favorited", Boolean(track && favorites.includes(track.id)));
  $("#favoriteNow").disabled = !track;
  $("#youtubePanel").classList.toggle("hidden", !youtubeTrack);
  if (youtubeTrack) $("#youtubeVideoTitle").textContent = `${track.title} — ${track.artist}`;
  $("#currentTime").textContent = formatTime(currentTime);
  $("#duration").textContent = formatTime(duration);
  $("#progressBar").value = duration ? (currentTime / duration) * 100 : 0;
  if (renderList) renderTracks();
}
async function playTrack(id) {
  const track = tracks.find(item => item.id === id);
  if (!track) return;
  const requestId = ++youtubePlayRequest;

  if (isYouTubeTrack(track)) {
    audio.pause();
    currentTrackId = id;
    $("#youtubePanel").classList.remove("hidden");
    $("#youtubeVideoTitle").textContent = `${track.title} — ${track.artist}`;
    updatePlayer();
    try {
      const player = await ensureYouTubePlayer();
      if (requestId !== youtubePlayRequest || currentTrackId !== id) return;
      player.loadVideoById(track.youtubeId);
    } catch (error) {
      showToast(error.message || "YouTube Player gagal dimuat.");
    }
    return;
  }

  clearInterval(youtubeSyncTimer);
  youtubeSyncTimer = null;
  if (youtubePlayerReady && youtubePlayer) youtubePlayer.pauseVideo();
  $("#youtubePanel").classList.add("hidden");
  if (currentTrackId !== id) {
    currentTrackId = id;
    audio.src = track.audio;
    audio.load();
  }
  try {
    await audio.play();
  } catch (error) {
    showToast("Audio belum bisa diputar. Periksa koneksi atau ganti URL audio di script.js.");
  }
  updatePlayer();
}
function pauseTrack() {
  const track = currentTrack();
  if (isYouTubeTrack(track)) {
    youtubePlayRequest++;
    if (youtubePlayerReady && youtubePlayer) youtubePlayer.pauseVideo();
  } else {
    audio.pause();
  }
  updatePlayer();
}
function toggleFavorite(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter(favoriteId => favoriteId !== id);
    showToast("Lagu dihapus dari favorit.");
  } else {
    favorites.push(id);
    showToast("Lagu ditambahkan ke favorit.");
  }
  saveFavorites();
  updatePlayer();
}
function playNext(direction = 1) {
  if (direction > 0 && queue.length) {
    const nextQueuedId = queue.shift(); saveQueue(); renderQueue(); playTrack(nextQueuedId); return;
  }
  if (currentView === "playlists" && activePlaylistId) {
    const playlist = playlists.find(item => item.id === activePlaylistId);
    const pool = (playlist?.trackIds || []).map(id => tracks.find(track => track.id === id)).filter(Boolean);
    if (pool.length) {
      let index = pool.findIndex(track => track.id === currentTrackId), nextIndex;
      if (shuffle && pool.length > 1) { do { nextIndex = Math.floor(Math.random() * pool.length); } while (nextIndex === index); }
      else nextIndex = index < 0 ? (direction > 0 ? 0 : pool.length - 1) : (index + direction + pool.length) % pool.length;
      playTrack(pool[nextIndex].id); return;
    }
  }
  const pool = filteredTracks().length ? filteredTracks() : tracks;
  if (!pool.length) return;
  let index = pool.findIndex(track => track.id === currentTrackId), nextIndex;
  if (shuffle && pool.length > 1) { do { nextIndex = Math.floor(Math.random() * pool.length); } while (nextIndex === index); }
  else nextIndex = index < 0 ? (direction > 0 ? 0 : pool.length - 1) : (index + direction + pool.length) % pool.length;
  playTrack(pool[nextIndex].id);
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
$("#searchInput").addEventListener("input", event => { query = event.target.value.trim(); renderTracks(); });
$("#addYouTubeButton").addEventListener("click", () => {
  if (!signedInUser) {
    setAuthStatus("Masuk ke akun untuk menyimpan lagu YouTube ke katalog pribadimu.");
    updateAccountUI();
    $("#authDialog").showModal();
    return;
  }
  $("#youtubeAddStatus").textContent = "";
  $("#youtubeAddStatus").classList.remove("error");
  $("#youtubeAddDialog").showModal();
  $("#youtubeUrlInput").focus();
});
$("#youtubeAddForm").addEventListener("submit", addYouTubeTrack);
$("#heroPlay").addEventListener("click", () => {
  const pool = filteredTracks();
  if (pool.length) playTrack(pool[0].id);
  else { setView("discover"); query = ""; $("#searchInput").value = ""; renderTracks(); playTrack(tracks[0].id); }
});
$("#playButton").addEventListener("click", () => {
  if (!currentTrackId) {
    playTrack(tracks[0].id);
  } else if (isPlaybackActive()) {
    pauseTrack();
  } else {
    const track = currentTrack();
    if (isYouTubeTrack(track) && youtubePlayerReady && youtubePlayer) youtubePlayer.playVideo();
    else playTrack(currentTrackId);
  }
});
$("#nextButton").addEventListener("click", () => playNext(1));
$("#previousButton").addEventListener("click", () => {
  const track = currentTrack();
  if (isYouTubeTrack(track)) {
    if (getYouTubeTime() > 3 && youtubePlayerReady) youtubePlayer.seekTo(0, true);
    else playNext(-1);
  } else if (audio.currentTime > 3) audio.currentTime = 0;
  else playNext(-1);
});
$("#shuffleButton").addEventListener("click", () => {
  shuffle = !shuffle;
  $("#shuffleButton").classList.toggle("enabled", shuffle);
  showToast(shuffle ? "Mode acak aktif." : "Mode acak nonaktif.");
});
$("#repeatButton").addEventListener("click", () => {
  repeat = !repeat;
  audio.loop = repeat;
  $("#repeatButton").classList.toggle("enabled", repeat);
  showToast(repeat ? "Ulangi lagu aktif." : "Ulangi lagu nonaktif.");
});
$("#favoriteNow").addEventListener("click", () => { if (currentTrackId) toggleFavorite(currentTrackId); });
$("#progressBar").addEventListener("input", event => {
  const track = currentTrack();
  const progress = Number(event.target.value) / 100;
  if (isYouTubeTrack(track)) {
    const duration = getYouTubeDuration();
    if (youtubePlayerReady && duration > 0) youtubePlayer.seekTo(progress * duration, true);
  } else if (Number.isFinite(audio.duration)) {
    audio.currentTime = progress * audio.duration;
  }
});
$("#volumeBar").addEventListener("input", event => {
  const value = Number(event.target.value);
  audio.volume = value;
  if (youtubePlayerReady && youtubePlayer) youtubePlayer.setVolume(Math.round(value * 100));
});
$("#queueButton").addEventListener("click", () => { renderQueue(); $("#queueDialog").showModal(); });
$("#playlistForm").addEventListener("submit", event => {
  event.preventDefault(); const playlist = createPlaylist($("#playlistNameInput").value);
  if (playlist) { $("#playlistNameInput").value = ""; activePlaylistId = playlist.id; renderPlaylists(); renderTracks(); }
});
$("#dialogPlaylistForm").addEventListener("submit", event => {
  event.preventDefault(); const playlist = createPlaylist($("#dialogPlaylistName").value);
  if (playlist && playlistTargetTrackId) addTrackToPlaylist(playlist.id, playlistTargetTrackId);
});
$("#clearQueueButton").addEventListener("click", () => {
  if (!queue.length) return; queue = []; saveQueue(); renderQueue(); showToast("Antrean dikosongkan.");
});
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => {
  const dialog = document.getElementById(button.dataset.closeDialog); if (dialog) dialog.close();
}));
document.querySelectorAll("dialog.nw-dialog").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault(); $("#searchInput").focus();
  }
  if (event.code === "Space" && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    if (!currentTrackId) playTrack(tracks[0].id);
    else if (isPlaybackActive()) pauseTrack();
    else {
      const track = currentTrack();
      if (isYouTubeTrack(track) && youtubePlayerReady && youtubePlayer) youtubePlayer.playVideo();
      else playTrack(currentTrackId);
    }
  }
});
audio.volume = Number($("#volumeBar").value);
audio.addEventListener("timeupdate", updatePlayer);
audio.addEventListener("loadedmetadata", updatePlayer);
audio.addEventListener("play", updatePlayer);
audio.addEventListener("pause", updatePlayer);
audio.addEventListener("ended", () => { if (!repeat) playNext(1); });
audio.addEventListener("error", () => {
  if (currentTrackId) showToast("Audio gagal dimuat. Coba lagi atau gunakan URL audio milikmu.");
});
saveFavorites();
savePlaylists();
saveQueue();
renderPlaylists();
renderQueue();
renderTracks();
updatePlayer();


function getSupabaseConfig() {
  const config = window.NEONWAVE_SUPABASE_CONFIG || {};
  return config.url && config.anonKey &&
    !config.url.includes("PASTE_") && !config.anonKey.includes("PASTE_") &&
    /^https:\/\/.+/.test(config.url) ? config : null;
}
function setAuthStatus(message, isError = false) {
  const el = $("#authStatus");
  el.textContent = message;
  el.classList.toggle("error", isError);
}
function updateAccountUI() {
  const label = $("#accountButtonLabel");
  const avatar = document.querySelector(".account-avatar");
  label.textContent = signedInUser ? (signedInUser.email.split("@")[0] || "Akun") : "Masuk";
  avatar.textContent = signedInUser ? (signedInUser.email.slice(0, 2).toUpperCase()) : "NW";
  $("#authTitle").textContent = signedInUser ? "Akun NEONWAVE" : (authMode === "login" ? "Masuk ke NEONWAVE" : "Buat akun NEONWAVE");
  $("#authDescription").textContent = signedInUser
    ? `Login sebagai ${signedInUser.email}. Playlist dan favorit bisa disimpan di database akunmu.`
    : "Masuk atau daftar untuk menyimpan playlist, antrean, dan favorit ke database.";
  $("#authForm").classList.toggle("hidden", Boolean(signedInUser));
  $("#authModeToggle").classList.toggle("hidden", Boolean(signedInUser));
  $("#signOutButton").classList.toggle("hidden", !signedInUser);
  $("#authSetupNote").classList.toggle("hidden", Boolean(supabaseClient));
  $("#authSubmit").textContent = authMode === "login" ? "Masuk" : "Daftar";
  $("#authModeToggle").textContent = authMode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk";
}
function scheduleCloudSave() {
  if (!signedInUser || !supabaseClient || applyingCloudData) return;
  clearTimeout(cloudSaveTimer);
  const scheduledUserId = signedInUser.id;
  cloudSaveTimer = setTimeout(() => saveCloudData(scheduledUserId), 700);
}

function persistLocalUserData() {
  try {
    localStorage.setItem("neonwave-favorites", JSON.stringify(favorites));
    localStorage.setItem("neonwave-playlists", JSON.stringify(playlists));
    localStorage.setItem("neonwave-queue", JSON.stringify(queue));
  } catch (error) {
    console.warn("NEONWAVE local cache:", error?.message || error);
  }
}

function clearActiveUserData() {
  clearTimeout(cloudSaveTimer);
  const playingTrack = currentTrack();
  if (playingTrack?.isCustomYouTube) {
    youtubePlayRequest++;
    if (youtubePlayerReady && youtubePlayer) youtubePlayer.pauseVideo();
    currentTrackId = null;
  }
  applyCustomTracks([]);
  applyingCloudData = true;
  favorites = [];
  playlists = [];
  queue = [];
  activePlaylistId = null;
  persistLocalUserData();
  applyingCloudData = false;
  $("#favoriteCount").textContent = "0";
  $("#playlistCount").textContent = "0";
  $("#queueCount").textContent = "0";
  renderPlaylists();
  renderQueue();
  renderTracks();
  updatePlayer();
}

async function saveCloudData(expectedUserId = signedInUser?.id) {
  if (!expectedUserId || !signedInUser || signedInUser.id !== expectedUserId || !supabaseClient || applyingCloudData) return;
  const payload = {
    user_id: expectedUserId,
    favorites,
    playlists,
    queue,
    custom_tracks: customTracks.map(track => ({
      title: track.title,
      artist: track.artist,
      youtubeId: track.youtubeId
    })),
    updated_at: new Date().toISOString()
  };
  const { error } = await supabaseClient.from("neonwave_user_data").upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.error("NEONWAVE cloud save:", error.message);
    showToast("Gagal menyimpan ke cloud. Data lokal tetap aman.");
    return false;
  }
  return true;
}

async function loadCloudData() {
  if (!signedInUser || !supabaseClient) return;
  const loadingUserId = signedInUser.id;
  const { data, error } = await supabaseClient.from("neonwave_user_data")
    .select("favorites,playlists,queue,custom_tracks").eq("user_id", loadingUserId).maybeSingle();
  if (error) {
    console.error("NEONWAVE cloud load:", error.message);
    showToast(error.message?.includes("custom_tracks")
      ? "Jalankan SQL migration custom_tracks sebelum memakai fitur tambah lagu."
      : "Data cloud belum bisa dimuat. Cek konfigurasi database.");
    return;
  }
  // Ignore a late response if the user signed out or switched accounts while loading.
  if (!signedInUser || signedInUser.id !== loadingUserId) return;

  applyingCloudData = true;
  applyCustomTracks(data && Array.isArray(data.custom_tracks) ? data.custom_tracks : []);
  if (data) {
    favorites = Array.isArray(data.favorites) ? data.favorites.filter(id => tracks.some(t => t.id === id)) : [];
    playlists = Array.isArray(data.playlists) ? data.playlists.filter(p => p && p.id && p.name && Array.isArray(p.trackIds)) : [];
    queue = Array.isArray(data.queue) ? data.queue.filter(id => tracks.some(t => t.id === id)) : [];
  } else {
    // New account: start empty. Never copy another account's browser localStorage into this user.
    applyCustomTracks([]);
    favorites = [];
    playlists = [];
    queue = [];
    activePlaylistId = null;
  }
  persistLocalUserData();
  applyingCloudData = false;

  $("#favoriteCount").textContent = favorites.length;
  $("#playlistCount").textContent = playlists.length;
  $("#queueCount").textContent = queue.length;
  renderPlaylists();
  renderQueue();
  renderTracks();
  updatePlayer();

  // Create a new, empty row for a first-time account instead of importing browser data.
  if (!data) await saveCloudData(loadingUserId);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthStatus("Supabase belum dikonfigurasi. Ikuti langkah config.js dan SQL di README.", true);
    return;
  }
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const submit = $("#authSubmit");
  submit.disabled = true;
  setAuthStatus(authMode === "login" ? "Sedang masuk..." : "Sedang membuat akun...");
  try {
    const result = authMode === "login"
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href.split("#")[0] } });
    if (result.error) throw result.error;
    if (authMode === "signup" && !result.data.session) {
      setAuthStatus("Akun dibuat. Cek email untuk konfirmasi, lalu login.");
      return;
    }
    signedInUser = result.data.user || null;
    updateAccountUI();
    if (signedInUser) {
      await loadCloudData();
      setAuthStatus("Berhasil masuk. Data akun sudah disinkronkan.");
      showToast("Login berhasil.");
    }
  } catch (error) {
    setAuthStatus(error.message || "Login gagal. Coba lagi.", true);
  } finally {
    submit.disabled = false;
  }
}
async function initializeAccount() {
  const config = getSupabaseConfig();
  if (config && window.supabase?.createClient) {
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = await supabaseClient.auth.getSession();
    signedInUser = data.session?.user || null;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      signedInUser = session?.user || null;
      if (event === "SIGNED_IN" && signedInUser) {
        clearTimeout(cloudSaveTimer);
        setTimeout(loadCloudData, 0);
      }
      if (event === "SIGNED_OUT") {
        clearActiveUserData();
        showToast("Kamu sudah keluar.");
      }
      updateAccountUI();
    });
    if (signedInUser) await loadCloudData();
    else clearActiveUserData();
  }
  updateAccountUI();
}
$("#accountButton").addEventListener("click", () => {
  if (!supabaseClient) setAuthStatus("Mode login belum aktif. Isi config.js dan setup database Supabase.", true);
  else setAuthStatus("");
  updateAccountUI();
  $("#authDialog").showModal();
});
$("#authClose").addEventListener("click", () => $("#authDialog").close());
$("#authForm").addEventListener("submit", handleAuthSubmit);
$("#authModeToggle").addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  $("#authPassword").setAttribute("autocomplete", authMode === "login" ? "current-password" : "new-password");
  setAuthStatus("");
  updateAccountUI();
});
$("#signOutButton").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) return setAuthStatus(error.message, true);
  signedInUser = null;
  clearActiveUserData();
  updateAccountUI();
  setAuthStatus("Kamu sudah keluar. Data cloud tetap tersimpan di akunmu.");
  $("#authPassword").value = "";
});

initializeAccount();


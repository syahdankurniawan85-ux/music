// NEONWAVE — music player demo. Ganti URL audio dengan file yang kamu punya izin untuk pakai.
const tracks = [
  { id: 1, title: "Midnight City Lights", artist: "Nova Echo", genre: "Synthwave", duration: "3:42", cover: "cover-1", initials: "NC", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "Ocean in Motion", artist: "Luna Pacific", genre: "Chill", duration: "4:12", cover: "cover-2", initials: "OP", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "Golden Hour", artist: "Sunday Club", genre: "Indie Pop", duration: "3:28", cover: "cover-3", initials: "GH", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: 4, title: "After the Rain", artist: "Velvet Static", genre: "Electronic", duration: "4:06", cover: "cover-4", initials: "AR", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id: 5, title: "Electric Bloom", artist: "Mira Sol", genre: "Dream Pop", duration: "3:51", cover: "cover-5", initials: "EB", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id: 6, title: "Soft Focus", artist: "The Blue Hours", genre: "Lo-fi", duration: "2:59", cover: "cover-6", initials: "SF", audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" }
];

const $ = (selector) => document.querySelector(selector);
const audio = $("#audio");
let currentTrackId = null;
let currentView = "discover";
let query = "";
let shuffle = false;
let repeat = false;
let toastTimer;

function readFavorites() {
  try { return JSON.parse(localStorage.getItem("neonwave-favorites") || "[]"); }
  catch { return []; }
}
let favorites = readFavorites();

function saveFavorites() {
  try { localStorage.setItem("neonwave-favorites", JSON.stringify(favorites)); }
  catch { showToast("Browser tidak bisa menyimpan favorit."); }
  $("#favoriteCount").textContent = favorites.length;
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
  return tracks.filter(track => {
    const matchesQuery = `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (currentView !== "favorites" || favorites.includes(track.id));
  });
}
function renderTracks() {
  const list = $("#trackList");
  const visibleTracks = filteredTracks();
  list.innerHTML = "";
  $("#emptyState").classList.toggle("hidden", visibleTracks.length > 0);
  $("#trackTotal").textContent = `${String(visibleTracks.length).padStart(2, "0")} TRACK${visibleTracks.length === 1 ? "" : "S"}`;
  $("#listHeading").innerHTML = currentView === "favorites" ? 'Your favorites <span class="heading-dot">.</span>' : 'Trending tracks <span class="heading-dot">.</span>';

  visibleTracks.forEach((track, index) => {
    const isPlaying = currentTrackId === track.id && !audio.paused;
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
      </div>`;
    row.querySelector(".track-text strong").textContent = track.title;
    row.querySelector(".track-text span").textContent = track.artist;
    row.querySelector(".track-genre").textContent = track.genre;
    row.querySelector(".row-play").addEventListener("click", () => {
      if (currentTrackId === track.id && !audio.paused) pauseTrack();
      else playTrack(track.id);
    });
    row.querySelector(".row-heart").addEventListener("click", () => toggleFavorite(track.id));
    list.appendChild(row);
  });
}
function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#viewTitle").textContent = view === "favorites" ? "Favorites" : "Discover";
  renderTracks();
}
function updatePlayer() {
  const track = tracks.find(item => item.id === currentTrackId);
  const playing = Boolean(track && !audio.paused);
  $("#playButton").textContent = playing ? "Ⅱ" : "▶";
  $("#playButton").setAttribute("aria-label", playing ? "Jeda" : "Putar");
  $("#nowTitle").textContent = track ? track.title : "Pilih sebuah lagu";
  $("#nowArtist").textContent = track ? track.artist : "Your next favorite is waiting";
  $("#miniCover").innerHTML = `<span>${track ? track.initials : "NW"}</span>`;
  $("#miniCover").className = `mini-cover${track ? " " + track.cover : ""}`;
  $("#favoriteNow").textContent = track && favorites.includes(track.id) ? "♥" : "♡";
  $("#favoriteNow").classList.toggle("favorited", Boolean(track && favorites.includes(track.id)));
  $("#favoriteNow").disabled = !track;
  $("#currentTime").textContent = formatTime(audio.currentTime);
  $("#duration").textContent = formatTime(audio.duration);
  $("#progressBar").value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  renderTracks();
}
async function playTrack(id) {
  const track = tracks.find(item => item.id === id);
  if (!track) return;
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
function pauseTrack() { audio.pause(); updatePlayer(); }
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
  const pool = filteredTracks().length ? filteredTracks() : tracks;
  if (!pool.length) return;
  let index = pool.findIndex(track => track.id === currentTrackId);
  let nextIndex;
  if (shuffle && pool.length > 1) {
    do { nextIndex = Math.floor(Math.random() * pool.length); } while (nextIndex === index);
  } else {
    nextIndex = index < 0 ? (direction > 0 ? 0 : pool.length - 1) : (index + direction + pool.length) % pool.length;
  }
  playTrack(pool[nextIndex].id);
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
$("#searchInput").addEventListener("input", event => { query = event.target.value.trim(); renderTracks(); });
$("#heroPlay").addEventListener("click", () => {
  const pool = filteredTracks();
  if (pool.length) playTrack(pool[0].id);
  else { setView("discover"); query = ""; $("#searchInput").value = ""; renderTracks(); playTrack(tracks[0].id); }
});
$("#playButton").addEventListener("click", () => {
  if (!currentTrackId) playTrack(tracks[0].id);
  else if (audio.paused) playTrack(currentTrackId);
  else pauseTrack();
});
$("#nextButton").addEventListener("click", () => playNext(1));
$("#previousButton").addEventListener("click", () => {
  if (audio.currentTime > 3) audio.currentTime = 0;
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
  if (Number.isFinite(audio.duration)) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
});
$("#volumeBar").addEventListener("input", event => { audio.volume = Number(event.target.value); });
$("#queueButton").addEventListener("click", () => { setView("discover"); window.scrollTo({ top: 0, behavior: "smooth" }); });
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault(); $("#searchInput").focus();
  }
  if (event.code === "Space" && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    if (!currentTrackId) playTrack(tracks[0].id);
    else if (audio.paused) playTrack(currentTrackId);
    else pauseTrack();
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
renderTracks();
updatePlayer();

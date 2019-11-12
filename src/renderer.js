const { remote, ipcRenderer, shell } = require("electron");
const mainProcess = remote.require("./index");

let fileSystemReport;
let spotifyReport = {};

//DIRECTORY
const $setDirButton = document.getElementById("set-directory");
const $currentDirectory = document.getElementById("current-directory");

//ARISTS
const $artistList = document.getElementById("artist-list");

$setDirButton.addEventListener("click", () => {
  mainProcess.getDirectoryFromUser();
});

function fetchFromSpotify(e) {
  const artist = e.target.dataset.artist;
  mainProcess.getAlbumListFromApi(artist);
}

function buildAristId(artist) {
  return artist.replace(/\s+/g, "-").toLowerCase();
}

//Directory Chosen
ipcRenderer.on("set-directory", setCurrentDirectory);
function setCurrentDirectory(event, dir) {
  $currentDirectory.innerHTML = `looking in: ${dir}`;
  mainProcess.readDirectory(dir);
}

//File List Returned
ipcRenderer.on("files-found", processFiles);
function processFiles(event, files) {
  mainProcess.getMetaDataReport(files);
}

//Meta Tags Analyzed
ipcRenderer.on("meta-report", processReport);
function processReport(event, report) {
  fileSystemReport = report;
  const header = `<h2>Found Artists:</h2>`;
  const artists = report.artists.map(a => {
    const albums = report.albums[a].map(
      al => `<li>${al || "::No Album::"}</li>`
    );
    return `<div class="artist-container">
    <div>  
      <h3>${a}</h3><ul>${albums.join("")}</ul>
    </div>
      <div id="spotify_${buildAristId(a)}">
      <button data-artist="${a}" class="fetch-from-spotify">Fetch From Spotify</button>
      </div>
    </div>`;
  });
  $artistList.innerHTML = `${header}${artists.join("")}`;

  // report.artists.forEach(a => {
  //   mainProcess.getAlbumListFromApi(a);
  // });

  const buttons = document.getElementsByClassName("fetch-from-spotify");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", fetchFromSpotify);
  }
}

//SPOTIFY REPORT
ipcRenderer.on("spotify-report", processSpotify);
function processSpotify(event, artist, report) {
  const artistId = buildAristId(artist);
  spotifyReport[artistId] = report;
  const id = `spotify_${artistId}`;
  const ownedAlbums = fileSystemReport.albums[artist];
  const albums = report.map(alb => {
    const owned = ownedAlbums.includes(alb.name);
    return `<div class="album-${alb.album_type} ${owned ? "owned" : ""}">${
      alb.name
    }</div>`;
  });
  document.getElementById(id).innerHTML = albums.join("");
}

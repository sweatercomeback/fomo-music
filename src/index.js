const { app, BrowserWindow, dialog } = require("electron");

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const recursive = require("recursive-readdir");
const mm = require("music-metadata");
const axios = require("axios");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
exports.getDirectoryFromUser = async () => {
  let options = { properties: ["openDirectory"] };
  const dir = await dialog.showOpenDialog(options);
  if (!dir || !dir.filePaths) {
    return;
  }
  mainWindow.webContents.send("set-directory", dir.filePaths[0]);
};

const approvedExtensions = [".m4a", ".mp3"];
function ignoreFunc(file, stats) {
  // `file` is the path to the file, and `stats` is an `fs.Stats`
  // object returned from `fs.lstat()`.
  if (stats.isDirectory()) {
    return false;
  }
  const ext = path.extname(file);
  return !approvedExtensions.includes(ext);
}

exports.readDirectory = dir => {
  recursive(dir, [ignoreFunc], function(err, files) {
    mainWindow.webContents.send("files-found", files);
  });
};

exports.getMetaDataReport = files => {
  const promises = files.map(f => {
    return mm.parseFile(f).then(meta => meta);
  });
  Promise.all(promises).then(r => {
    const report = r.reduce(
      (list, item) => {
        const artist = item.common.artist;
        const album = item.common.album;
        if (!list.artists.includes(artist)) {
          list.artists.push(artist);
          list.albums[artist] = [album];
        } else {
          if (!!album && !list.albums[artist].includes(album)) {
            list.albums[artist].push(album);
          }
        }

        return list;
      },
      {
        artists: [],
        albums: {}
      }
    );
    mainWindow.webContents.send("meta-report", report);
  });
};

let token;
const getSpotifyToken = (id, secret) => {
  if (token) {
    return Promise.resolve(token);
  }
  return axios({
    url: "https://accounts.spotify.com/api/token",
    method: "post",
    params: {
      grant_type: "client_credentials"
    },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    auth: {
      username: id,
      password: secret
    }
  })
    .then(function(response) {
      console.log(response.data);
      return response.data.access_token;
    })
    .catch(function(error) {});
};
var SpotifyWebApi = require("spotify-web-api-node");

exports.getAlbumListFromApi = async artist => {
  const accessToken = await getSpotifyToken(
    process.env.SPOTIFY_CLIENTID,
    process.env.SPOTIFY_SECRET
  );
  var spotifyApi = new SpotifyWebApi();
  spotifyApi.setAccessToken(accessToken);
  const data = await spotifyApi.searchArtists(artist);

  const foundArtists = data.body.artists;
  if (!foundArtists || foundArtists.total === 0) {
    return;
  }
  const foundArtist = foundArtists.items[0];

  const albums = await spotifyApi.getArtistAlbums(foundArtist.id);
  if (!albums.body || albums.body.total === 0) {
    return;
  }
  mainWindow.webContents.send("spotify-report", artist, albums.body.items);
};

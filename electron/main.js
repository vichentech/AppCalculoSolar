import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
const DIST_PATH = path.join(__dirname, '../dist');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Let Vite handle the HTML file serving when in dev
const indexHtml = path.join(DIST_PATH, 'index.html');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Security best practices:
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open DevTools in dev mode (comentado a petición)
    // win.webContents.openDevTools();
  } else {
    // In production, load the built HTML
    win.loadFile(indexHtml);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

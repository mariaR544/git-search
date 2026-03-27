const { app, BrowserWindow } = require('electron');
const path = require('path');

// Iniciar el backend y el servidor Express local
// require('./src/server.js');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1024,
        minHeight: 700,
        title: "GIT-SEARCH",
        backgroundColor: '#0a0a0a',
        autoHideMenuBar: true, // Ocultar barra superior tipo navegador
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Conectar el frontend a la instancia de Express
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3005');
    }, 1000);

    // Opcional: mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
        process.exit(0);
    }
});

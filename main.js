const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const fs = require("fs");
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile("codeEditor.html");

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "Ctrl+N",
          click: () => {
            console.log("New File menu clicked");

            mainWindow.webContents.executeJavaScript(`
                if (window.editorInstance) {
                  window.editorInstance.createUntitledTab();
                } else {
                  console.error("editorInstance not found");
                }
            `);
          }
        },
        { type: "separator" },
        {
          label: "Logout",
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              localStorage.removeItem("isLoggedIn");
              localStorage.removeItem("userData");
              location.reload();
            `);
          }
        },
        { type: "separator" },
        {
          role: "quit"
        }
      ]
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
console.log("Main.js loaded");

ipcMain.handle("save-file", async (event, data) => {
  try {
    let filePath = data.filePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        defaultPath: data.defaultName || "untitled.js"
      });
      if (result.canceled) {
        return {
          success: false,
          canceled: true
        };
      }
      filePath = result.filePath;
    }
    fs.writeFileSync(filePath, data.content, "utf8");
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath)
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err.message
    };
  }
});

app.whenReady().then(() => {
  // Configure session to accept cookies
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Credentials': ['true']
      }
    });
  });

  // Enable third-party cookies
  session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
    console.log('Cookie event:', cause, removed ? 'removed' : 'added', cookie.name);
  });

  createWindow();
});

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


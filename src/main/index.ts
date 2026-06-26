import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerContentIpcHandlers } from './ipc/content'
import { registerCardIpcHandlers } from './ipc/card'
import { registerImageIpcHandlers } from './ipc/image'
import { registerFrameIpcHandlers } from './ipc/frame'
import { registerVideoIpcHandlers } from './ipc/video'
import { registerManuscriptIpcHandlers } from './ipc/manuscript'
import { registerSettingsIpcHandlers } from './ipc/settings'

function createWindow(): void {
  // Create the browser window.
  // AD-1: Main/Renderer 권한 분리 - contextIsolation:true, nodeIntegration:false는 협상 불가.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:true의 내장 preload 모듈 로더가 패키징(asar) 환경에서 @electron-toolkit/preload의
      // package.json "exports" 맵을 해석하지 못해 IPC 브리지 전체가 깨지는 문제(Electron 42 확인됨).
      // contextIsolation:true + nodeIntegration:false(AD-1 필수)는 유지하고, sandbox만 비활성화.
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('net.haion.sns-content-tool')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerContentIpcHandlers()
  registerCardIpcHandlers()
  registerImageIpcHandlers()
  registerFrameIpcHandlers()
  registerVideoIpcHandlers()
  registerManuscriptIpcHandlers()
  registerSettingsIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

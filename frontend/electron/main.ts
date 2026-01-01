import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, continue
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    // In development, wait for dev server to be ready
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err);
      mainWindow.webContents.once('did-fail-load', () => {
        console.log('Dev server not ready, showing error page');
        mainWindow.webContents.send('dev-server-error');
      });
    });
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = join(__dirname, '../dist/index.html');
    console.log('Loading production build from:', indexPath);
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load production build:', err);
    });
  }
  
  // Log any loading errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });
};

// IPC handlers for file operations
ipcMain.handle('read-file', async (_event, path: string) => {
  try {
    const content = await readFile(path, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

ipcMain.handle('write-file', async (_event, path: string, data: string) => {
  try {
    await writeFile(path, data, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

ipcMain.handle('show-open-dialog', async (_event, options: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});

ipcMain.handle('show-save-dialog', async (_event, options: Electron.SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(options);
  return result;
});

// Request file system permissions for macOS
app.on('ready', () => {
  if (process.platform === 'darwin') {
    // Request file access permissions
    // Note: Actual permission requests happen when user interacts with file dialogs
    // macOS will prompt for permissions when file dialogs are used
  }
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


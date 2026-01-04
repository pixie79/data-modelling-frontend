import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import * as path from 'path';
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

// Helper function to get icon path
const getIconPath = (): string | undefined => {
  const possiblePaths = [
    path.join(__dirname, '../electron/icons/icon.png'),
    path.join(__dirname, '../electron/icons/icon.icns'),
    path.join(__dirname, '../../electron/icons/icon.png'),
    path.join(__dirname, '../../electron/icons/icon.icns'),
    path.join(app.getAppPath(), 'electron/icons/icon.png'),
    path.join(app.getAppPath(), 'electron/icons/icon.icns'),
  ];
  
  for (const iconFile of possiblePaths) {
    if (existsSync(iconFile)) {
      console.log('[Electron] Found icon:', iconFile);
      return iconFile;
    }
  }
  console.log('[Electron] No icon found, using default');
  return undefined;
};

const createWindow = (): void => {
  // Determine icon path based on platform and availability
  const iconPath = getIconPath();
  
  // Convert icon path to nativeImage for better cross-platform support
  let iconImage: Electron.NativeImage | undefined;
  if (iconPath) {
    try {
      iconImage = nativeImage.createFromPath(iconPath);
      if (iconImage.isEmpty()) {
        console.warn('[Electron] Icon image is empty, falling back to path');
        iconImage = undefined;
      }
    } catch (error) {
      console.warn('[Electron] Failed to create native image from icon path:', error);
      iconImage = undefined;
    }
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Open Data Modelling',
    icon: iconImage || iconPath, // Use nativeImage if available, fallback to path
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });
  
  // Set Content Security Policy for file:// protocol
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
  
  // Also set CSP via meta tag injection for file:// protocol
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';";
        document.head.appendChild(meta);
      }
    `).catch(() => {
      // Ignore errors
    });
  });

  // Load the app
  // Prioritize NODE_ENV over app.isPackaged
  // If NODE_ENV=production, always use production build (offline mode)
  // Only use dev server if explicitly in development mode
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Resolve path relative to the main process file location
  // __dirname points to dist-electron/ when running built Electron app
  // app.getAppPath() returns the app's directory (frontend/ in dev, app.asar in packaged)
  const appPath = app.getAppPath();
  const indexPath = path.join(appPath, 'dist', 'index.html');
  const indexPathResolved = path.resolve(indexPath);
  
  console.log('app.getAppPath():', appPath);
  console.log('__dirname:', __dirname);
  console.log('indexPath:', indexPath);
  console.log('indexPath (resolved):', indexPathResolved);
  console.log('File exists:', existsSync(indexPathResolved));
  
  if (isProduction || existsSync(indexPathResolved)) {
    // Production mode: load from built files (offline mode)
    console.log('Loading production build from:', indexPathResolved);
    // Use loadFile with resolved absolute path
    mainWindow.loadFile(indexPathResolved).catch((err) => {
      console.error('Failed to load production build:', err);
      console.error('Attempted path:', indexPathResolved);
      // Try alternative path resolution
      const altPath = path.join(__dirname, '../dist/index.html');
      const altPathResolved = path.resolve(altPath);
      console.log('Trying alternative path:', altPathResolved);
      if (existsSync(altPathResolved)) {
        mainWindow.loadFile(altPathResolved).catch((altErr) => {
          console.error('Alternative path also failed:', altErr);
          // If production build fails and we're not explicitly in production, try dev server
          if (!isProduction) {
            console.log('Falling back to dev server...');
            mainWindow.loadURL('http://localhost:5173').catch((devErr) => {
              console.error('Failed to load dev server:', devErr);
            });
            mainWindow.webContents.openDevTools();
          }
        });
      } else if (!isProduction) {
        console.log('Falling back to dev server...');
        mainWindow.loadURL('http://localhost:5173').catch((devErr) => {
          console.error('Failed to load dev server:', devErr);
        });
        mainWindow.webContents.openDevTools();
      }
    });
  } else {
    // Development mode: use dev server
    console.log('Loading from dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err);
      mainWindow.webContents.once('did-fail-load', () => {
        console.log('Dev server not ready, showing error page');
        mainWindow.webContents.send('dev-server-error');
      });
    });
    mainWindow.webContents.openDevTools();
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

ipcMain.handle('write-file', async (_event, filePath: string, data: string) => {
  try {
    // Ensure the directory exists before writing the file
    const dirPath = path.dirname(filePath);
    if (!existsSync(dirPath)) {
      console.log(`[Electron] Creating directory: ${dirPath}`);
      try {
        await mkdir(dirPath, { recursive: true });
        console.log(`[Electron] Directory created successfully: ${dirPath}`);
      } catch (mkdirError) {
        const mkdirErrorMessage = mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
        console.error(`[Electron] Failed to create directory: ${dirPath}`, mkdirErrorMessage);
        throw new Error(`Failed to create directory ${dirPath}: ${mkdirErrorMessage}`);
      }
    }
    await writeFile(filePath, data, 'utf-8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Electron] Failed to write file: ${filePath}`, errorMessage);
    throw new Error(`Failed to write file: ${errorMessage}`);
  }
});

ipcMain.handle('ensure-directory', async (_event, dirPath: string) => {
  try {
    if (!existsSync(dirPath)) {
      console.log(`[Electron] Creating directory: ${dirPath}`);
      await mkdir(dirPath, { recursive: true });
      console.log(`[Electron] Directory created successfully: ${dirPath}`);
      return true;
    }
    return true; // Directory already exists
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Electron] Failed to create directory: ${dirPath}`, errorMessage);
    throw new Error(`Failed to create directory ${dirPath}: ${errorMessage}`);
  }
});

ipcMain.handle('read-directory', async (_event, dirPath: string) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
      }));
    return files;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Electron] Failed to read directory: ${dirPath}`, errorMessage);
    throw new Error(`Failed to read directory ${dirPath}: ${errorMessage}`);
  }
});

ipcMain.handle('delete-file', async (_event, filePath: string) => {
  try {
    await unlink(filePath);
    console.log(`[Electron] Deleted file: ${filePath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Don't throw if file doesn't exist (already deleted)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[Electron] Failed to delete file: ${filePath}`, errorMessage);
      throw new Error(`Failed to delete file ${filePath}: ${errorMessage}`);
    }
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

// Set application name
app.setName('Open Data Modelling');

// Set dock/tray icon for macOS
if (process.platform === 'darwin') {
  app.whenReady().then(() => {
    const iconPath = getIconPath();
    if (iconPath && app.dock) {
      try {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          app.dock.setIcon(iconPath);
          console.log('[Electron] Dock icon set successfully');
        } else {
          console.warn('[Electron] Icon file exists but could not be loaded');
        }
      } catch (error) {
        console.warn('[Electron] Failed to set dock icon:', error);
      }
    }
  });
}

// Request file system permissions for macOS
app.on('ready', () => {
  if (process.platform === 'darwin') {
    // Request file access permissions
    // Note: Actual permission requests happen when user interacts with file dialogs
    // macOS will prompt for permissions when file dialogs are used
  }
  createWindow();
});

// IPC handler for closing the app
ipcMain.handle('close-app', () => {
  app.quit();
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


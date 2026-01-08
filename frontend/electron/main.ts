import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
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
    const csp =
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // Also set CSP via meta tag injection for file:// protocol
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(
        `
      if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';";
        document.head.appendChild(meta);
      }
    `
      )
      .catch(() => {
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
    throw new Error(
      `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
        const mkdirErrorMessage =
          mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
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
      .filter((entry) => entry.isFile())
      .map((entry) => ({
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

// ============================================================================
// DuckDB-related IPC handlers
// ============================================================================

/**
 * Export database/OPFS data to a native file
 * This allows saving browser database content to the local filesystem
 */
ipcMain.handle(
  'duckdb:export',
  async (
    _event,
    options: {
      data: ArrayBuffer | string;
      defaultPath?: string;
      format: 'json' | 'csv' | 'duckdb';
    }
  ) => {
    try {
      const filters: Electron.FileFilter[] = [];
      let defaultExtension = '';

      switch (options.format) {
        case 'json':
          filters.push({ name: 'JSON Files', extensions: ['json'] });
          defaultExtension = '.json';
          break;
        case 'csv':
          filters.push({ name: 'CSV Files', extensions: ['csv'] });
          defaultExtension = '.csv';
          break;
        case 'duckdb':
          filters.push({ name: 'DuckDB Database', extensions: ['duckdb', 'db'] });
          defaultExtension = '.duckdb';
          break;
      }

      const defaultPath =
        options.defaultPath ||
        `data-model-export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}${defaultExtension}`;

      const result = await dialog.showSaveDialog({
        title: 'Export Database',
        defaultPath,
        filters,
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // Write the data to file
      const dataToWrite =
        typeof options.data === 'string' ? options.data : Buffer.from(options.data);

      await writeFile(result.filePath, dataToWrite);
      console.log(`[Electron] DuckDB export saved to: ${result.filePath}`);

      return { success: true, filePath: result.filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Electron] DuckDB export failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
);

/**
 * Import database file from native filesystem
 * This allows loading database content from local files into the browser
 */
ipcMain.handle(
  'duckdb:import',
  async (
    _event,
    options: {
      formats?: ('json' | 'csv' | 'duckdb')[];
    }
  ) => {
    try {
      const filters: Electron.FileFilter[] = [];
      const formats = options.formats || ['json', 'csv'];

      if (formats.includes('json')) {
        filters.push({ name: 'JSON Files', extensions: ['json'] });
      }
      if (formats.includes('csv')) {
        filters.push({ name: 'CSV Files', extensions: ['csv'] });
      }
      if (formats.includes('duckdb')) {
        filters.push({ name: 'DuckDB Database', extensions: ['duckdb', 'db'] });
      }
      filters.push({ name: 'All Files', extensions: ['*'] });

      const result = await dialog.showOpenDialog({
        title: 'Import Database',
        filters,
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      if (!filePath) {
        return { success: false, error: 'No file selected' };
      }
      const content = await readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();

      // Determine format from extension
      let format: 'json' | 'csv' | 'duckdb' | 'unknown' = 'unknown';
      if (extension === '.json') format = 'json';
      else if (extension === '.csv') format = 'csv';
      else if (extension === '.duckdb' || extension === '.db') format = 'duckdb';

      console.log(`[Electron] DuckDB import from: ${filePath} (format: ${format})`);

      return {
        success: true,
        filePath,
        format,
        content: content.toString('utf-8'),
        size: content.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Electron] DuckDB import failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
);

/**
 * Get database file info (size, modification date, etc.)
 */
ipcMain.handle('duckdb:file-info', async (_event, filePath: string) => {
  try {
    const { stat } = await import('fs/promises');
    const stats = await stat(filePath);
    return {
      success: true,
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      isFile: stats.isFile(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
});

/**
 * Check if a database file exists
 */
ipcMain.handle('duckdb:file-exists', async (_event, filePath: string) => {
  return existsSync(filePath);
});

/**
 * Delete a database file
 */
ipcMain.handle('duckdb:delete-file', async (_event, filePath: string) => {
  try {
    await unlink(filePath);
    console.log(`[Electron] Deleted database file: ${filePath}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Electron] Failed to delete database file:', errorMessage);
    return { success: false, error: errorMessage };
  }
});

/**
 * Create a backup of a database file
 */
ipcMain.handle(
  'duckdb:backup',
  async (_event, options: { sourcePath: string; backupPath?: string }) => {
    try {
      const { copyFile } = await import('fs/promises');
      const backupPath =
        options.backupPath ||
        `${options.sourcePath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;

      await copyFile(options.sourcePath, backupPath);
      console.log(`[Electron] Database backup created: ${backupPath}`);

      return { success: true, backupPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Electron] Database backup failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
);

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

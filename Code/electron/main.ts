import { app, BrowserWindow, ipcMain, Menu, net, protocol, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promises as fs } from 'node:fs'
import { LEEOS_FS_CAPABILITIES, LEEOS_METHOD } from '../src/shared/capabilities'

const isDev = !app.isPackaged
const APP_DISPLAY_NAME = 'LeeOS'
app.setName(APP_DISPLAY_NAME)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLUGINS_DIR = isDev
  ? path.join(app.getAppPath(), 'plugins')
  : path.join(process.resourcesPath, 'plugins')
const PLUGIN_DATA_DIR = path.join(app.getPath('userData'), 'plugin-data')

type PluginManifest = {
  id: string
  name: string
  version: string
  description?: string
  entry?: string
  icon?: string
  category?: string
  order?: number
}

type PluginEntry = PluginManifest & {
  entryUrl?: string
  iconUrl?: string
}

const pluginPaths = new Map<string, string>()

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const PLUGIN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/

const assertValidPluginId = (pluginId: unknown) => {
  if (typeof pluginId !== 'string') {
    throw new Error('Invalid pluginId')
  }
  const trimmed = pluginId.trim()
  const looksValid = PLUGIN_ID_PATTERN.test(trimmed) && trimmed.includes('.')
  if (!looksValid) {
    throw new Error('Invalid pluginId')
  }
  return trimmed
}

const encodeUrlPath = (inputPath: string) => {
  return inputPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

const isPathUnder = (baseDir: string, targetPath: string) => {
  const resolvedBase = path.resolve(baseDir)
  const resolved = path.resolve(targetPath)
  if (resolved === resolvedBase) {
    return true
  }
  const prefix = resolvedBase.endsWith(path.sep) ? resolvedBase : `${resolvedBase}${path.sep}`
  return resolved.startsWith(prefix)
}

const resolveUnder = (baseDir: string, relativePath: string) => {
  if (typeof relativePath !== 'string') {
    throw new Error('Invalid path')
  }
  const trimmed = relativePath.trim()
  if (!trimmed) {
    throw new Error('Invalid path')
  }
  const normalized = trimmed.replace(/^\/+/, '')
  const resolvedBase = path.resolve(baseDir)
  const resolved = path.resolve(resolvedBase, normalized)
  const prefix = resolvedBase.endsWith(path.sep) ? resolvedBase : `${resolvedBase}${path.sep}`
  if (resolved !== resolvedBase && !resolved.startsWith(prefix)) {
    throw new Error('Path escapes plugin sandbox')
  }
  return resolved
}

const assertRealpathUnder = async (baseDir: string, targetPath: string) => {
  const [baseReal, targetReal] = await Promise.all([fs.realpath(baseDir), fs.realpath(targetPath)])
  if (!isPathUnder(baseReal, targetReal)) {
    throw new Error('Path escapes plugin sandbox')
  }
}

const assertNoSymlinkTraversal = async (baseDir: string, targetDir: string) => {
  const resolvedBase = path.resolve(baseDir)
  const resolvedTarget = path.resolve(targetDir)
  const relative = path.relative(resolvedBase, resolvedTarget)
  if (!relative || relative === '.') {
    return
  }
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes plugin sandbox')
  }
  const segments = relative.split(path.sep).filter((segment) => segment.length > 0)
  let current = resolvedBase
  for (const segment of segments) {
    current = path.join(current, segment)
    try {
      const stat = await fs.lstat(current)
      if (stat.isSymbolicLink()) {
        throw new Error('Symlink traversal is not allowed')
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'ENOENT') {
        return
      }
      throw error
    }
  }
}

const assertNotSymlink = async (targetPath: string) => {
  try {
    const stat = await fs.lstat(targetPath)
    if (stat.isSymbolicLink()) {
      throw new Error('Symlink traversal is not allowed')
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code === 'ENOENT') {
      return
    }
    throw error
  }
}

const prepareSafeWriteTarget = async (baseDir: string, targetPath: string) => {
  const parentDir = path.dirname(targetPath)
  await assertNoSymlinkTraversal(baseDir, parentDir)
  await ensureDir(parentDir)
  await assertRealpathUnder(baseDir, parentDir)
  await assertNotSymlink(targetPath)
}

const pluginDataDir = async (pluginId: string) => {
  const safePluginId = assertValidPluginId(pluginId)
  await ensureDir(PLUGIN_DATA_DIR)
  const pluginDataRootReal = await fs.realpath(PLUGIN_DATA_DIR)
  const baseDir = resolveUnder(PLUGIN_DATA_DIR, safePluginId)
  await ensureDir(baseDir)
  const baseStat = await fs.lstat(baseDir)
  if (baseStat.isSymbolicLink()) {
    throw new Error('Symlink traversal is not allowed')
  }
  const baseReal = await fs.realpath(baseDir)
  if (!isPathUnder(pluginDataRootReal, baseReal)) {
    throw new Error('Path escapes plugin sandbox')
  }
  return baseDir
}

const resolvePluginEntry = async (
  pluginPath: string,
  manifestEntry?: string,
): Promise<string | undefined> => {
  const entryFile = manifestEntry && manifestEntry.trim().length > 0 ? manifestEntry : 'index.html'
  const entryPath = resolveUnder(pluginPath, entryFile)
  try {
    await fs.access(entryPath)
    return `leeos-plugin://${path.basename(pluginPath)}/${encodeUrlPath(entryFile)}`
  } catch {
    return undefined
  }
}

let mainWindow: BrowserWindow | null = null

ipcMain.on('leeos.app.getVersion', (event) => {
  event.returnValue = app.getVersion()
})

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim() || 'http://localhost:5173/'
    const load = async (attempt = 0) => {
      try {
        await mainWindow?.loadURL(devServerUrl)
      } catch (error) {
        if (attempt >= 40) {
          throw error
        }
        const delayMs = Math.min(1500, 100 + attempt * 50)
        setTimeout(() => {
          void load(attempt + 1)
        }, delayMs)
      }
    }
    void load()
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const configureApplicationMenu = () => {
  if (process.platform === 'darwin') {
    const appSubmenu: MenuItemConstructorOptions[] = []
    if (isDev) {
      appSubmenu.push({
        label: 'Refresh',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          mainWindow?.webContents.reload()
        },
      })
      appSubmenu.push({ type: 'separator' })
    }
    appSubmenu.push({
      label: 'quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => app.quit(),
    })
    const editSubmenu: MenuItemConstructorOptions[] = [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ]

    const template: MenuItemConstructorOptions[] = [
      {
        label: APP_DISPLAY_NAME,
        submenu: appSubmenu,
      },
      {
        label: 'Edit',
        submenu: editSubmenu,
      },
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    return
  }
  Menu.setApplicationMenu(null)
}

const readPluginManifest = async (pluginPath: string): Promise<PluginEntry | null> => {
  const manifestPath = path.join(pluginPath, 'manifest.json')
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw) as PluginManifest
    const id = typeof manifest.id === 'string' ? manifest.id.trim() : ''
    const name = typeof manifest.name === 'string' ? manifest.name.trim() : ''
    const version = typeof manifest.version === 'string' ? manifest.version.trim() : ''
    const folderName = path.basename(pluginPath)
    const idLooksValid = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(id) && id.includes('.')
    if (!idLooksValid || !name || !version || folderName !== id) {
      return null
    }
    const entryUrl = await resolvePluginEntry(pluginPath, manifest.entry)
    const iconUrl = manifest.icon
      ? `leeos-plugin://${id}/${encodeUrlPath(manifest.icon)}`
      : undefined
    return {
      ...manifest,
      id,
      name,
      version,
      description: typeof manifest.description === 'string' ? manifest.description : undefined,
      category: typeof manifest.category === 'string' ? manifest.category : undefined,
      order: typeof manifest.order === 'number' && !Number.isNaN(manifest.order)
        ? manifest.order
        : undefined,
      entryUrl,
      iconUrl,
    }
  } catch {
    if (isDev) {
      console.warn(`[LeeOS] Failed to read manifest: ${manifestPath}`)
    }
    return null
  }
}

const listPlugins = async (): Promise<PluginEntry[]> => {
  try {
    const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true })
    const pluginDirs = entries.filter((entry) => entry.isDirectory())
    const manifests = await Promise.all(
      pluginDirs.map((entry) => readPluginManifest(path.join(PLUGINS_DIR, entry.name))),
    )
    const valid = manifests.filter((manifest): manifest is PluginEntry => Boolean(manifest))
    pluginPaths.clear()
    valid.forEach((manifest) => {
      const folderName = manifest.id
      const resolvedPath = path.join(PLUGINS_DIR, folderName)
      pluginPaths.set(manifest.id, resolvedPath)
    })
    return valid.sort((a, b) => {
      const orderA = a.order ?? 9999
      const orderB = b.order ?? 9999
      if (orderA !== orderB) {
        return orderA - orderB
      }
      return a.name.localeCompare(b.name)
    })
  } catch {
    if (isDev) {
      console.warn(`[LeeOS] Failed to read plugins directory: ${PLUGINS_DIR}`)
    }
    return []
  }
}

const pluginSdkScript = (pluginId: string) => {
  return `
    window.LeeOS = window.LeeOS || {};
    window.LeeOS._hostOrigin = (function() {
      try {
        return document.referrer ? new URL(document.referrer).origin : '';
      } catch (e) {
        return '';
      }
    })();
    window.LeeOS._request = function(method, params) {
      return new Promise(function(resolve, reject) {
        var requestId = 'req_' + Math.random().toString(36).slice(2);
        var settled = false;
        var timeoutId = 0;
        function cleanup() {
          window.removeEventListener('message', handler);
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = 0;
          }
        }
        function finish(ok, value) {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          if (ok) {
            resolve(value);
          } else {
            reject(value);
          }
        }
        function handler(event) {
          if (event.source !== window.parent) {
            return;
          }
          if (window.LeeOS._hostOrigin && event.origin !== window.LeeOS._hostOrigin) {
            return;
          }
          var data = event.data || {};
          if (data.type === 'LeeOS:response' && data.requestId === requestId) {
            if (data.ok) {
              finish(true, data.data);
            } else {
              finish(false, new Error(data.error || 'Request failed'));
            }
          }
        }
        window.addEventListener('message', handler);
        timeoutId = window.setTimeout(function() {
          finish(false, new Error('Request timed out'));
        }, 8000);
        window.parent.postMessage({
          type: 'LeeOS:request',
          pluginId: ${JSON.stringify(pluginId)},
          requestId: requestId,
          method: method,
          params: params
        }, '*');
      });
    };
    window.LeeOS.plugins = {
      list: function() {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.pluginsList)});
      }
    };
    window.LeeOS.fs = {
      readText: function(filePath) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsReadText)}, { path: filePath });
      },
      writeText: function(filePath, content) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsWriteText)}, { path: filePath, content: content });
      },
      readJson: function(filePath) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsReadJson)}, { path: filePath });
      },
      writeJson: function(filePath, value) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsWriteJson)}, { path: filePath, value: value });
      },
      readDir: function(directoryPath) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsReadDir)}, { path: directoryPath || '.' });
      },
      delete: function(targetPath) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsDelete)}, { path: targetPath });
      },
      openDir: function(directoryPath) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsOpenDir)}, { path: directoryPath || '.' })
          .then(function(value) { return Boolean(value); })
          .catch(function() { return false; });
      },
      openFile: function(filePath) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.fsOpenFile)}, { path: filePath })
          .then(function(value) { return Boolean(value); })
          .catch(function() { return false; });
      },
      capabilities: function() {
        return Promise.resolve(${JSON.stringify(LEEOS_FS_CAPABILITIES)});
      }
    };
    window.LeeOS.system = {
      openExternal: function(url) {
        return window.LeeOS._request(${JSON.stringify(LEEOS_METHOD.systemOpenExternal)}, { url: url })
          .then(function(value) { return Boolean(value); })
          .catch(function() { return false; });
      }
    };
  `
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'leeos-plugin',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

app.whenReady().then(async () => {
  configureApplicationMenu()
  await listPlugins()
  protocol.handle('leeos-plugin', async (request) => {
    const fail = (reason?: unknown) => {
      if (isDev) {
        const message = reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason ?? '')
        console.warn(`[LeeOS] leeos-plugin protocol failed: ${request.url}${message ? `\n${message}` : ''}`)
      }
      return new Response('Not Found', { status: 404 })
    }
    try {
      const url = new URL(request.url)
      const pluginId = assertValidPluginId(url.hostname)
      let basePath = pluginPaths.get(pluginId)
      if (!basePath) {
        await listPlugins()
        basePath = pluginPaths.get(pluginId)
      }
      if (!basePath) {
        return fail(`Unknown pluginId: ${pluginId}`)
      }
      const baseReal = await fs.realpath(basePath)
      const rawPathname = url.pathname && url.pathname.length > 0 ? url.pathname : '/index.html'
      let relativePath = '/index.html'
      try {
        const decoded = decodeURIComponent(rawPathname)
        relativePath = decoded === '/' ? '/index.html' : decoded
      } catch (error) {
        return fail(error)
      }
      const resolved = resolveUnder(basePath, relativePath)
      const resolvedReal = await fs.realpath(resolved)
      if (!isPathUnder(baseReal, resolvedReal)) {
        return fail('Path escapes plugin sandbox')
      }
      if (resolved.endsWith('.html')) {
        const html = await fs.readFile(resolved, 'utf-8')
        const injection = `<script>${pluginSdkScript(pluginId)}</script>`
        const patched = html.includes('</head>')
          ? html.replace('</head>', `${injection}</head>`)
          : `${injection}${html}`
        return new Response(patched, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        })
      }
      return net.fetch(pathToFileURL(resolved).toString())
    } catch (error) {
      return fail(error)
    }
  })
  ipcMain.handle('leeos.plugins.list', async () => listPlugins())
  ipcMain.handle('leeos.fs.readText', async (_event, payload: { pluginId: string; path: string }) => {
    const baseDir = await pluginDataDir(payload.pluginId)
    const resolved = resolveUnder(baseDir, payload.path)
    await assertRealpathUnder(baseDir, resolved)
    return fs.readFile(resolved, 'utf-8')
  })
  ipcMain.handle(
    'leeos.fs.writeText',
    async (_event, payload: { pluginId: string; path: string; content: string }) => {
      const baseDir = await pluginDataDir(payload.pluginId)
      const resolved = resolveUnder(baseDir, payload.path)
      await prepareSafeWriteTarget(baseDir, resolved)
      await fs.writeFile(resolved, payload.content, 'utf-8')
    },
  )
  ipcMain.handle('leeos.fs.readJson', async (_event, payload: { pluginId: string; path: string }) => {
    const baseDir = await pluginDataDir(payload.pluginId)
    const resolved = resolveUnder(baseDir, payload.path)
    await assertRealpathUnder(baseDir, resolved)
    const raw = await fs.readFile(resolved, 'utf-8')
    return JSON.parse(raw) as unknown
  })
  ipcMain.handle(
    'leeos.fs.writeJson',
    async (_event, payload: { pluginId: string; path: string; value: unknown }) => {
      const baseDir = await pluginDataDir(payload.pluginId)
      const resolved = resolveUnder(baseDir, payload.path)
      await prepareSafeWriteTarget(baseDir, resolved)
      await fs.writeFile(resolved, JSON.stringify(payload.value, null, 2), 'utf-8')
    },
  )
  ipcMain.handle('leeos.fs.readDir', async (_event, payload: { pluginId: string; path: string }) => {
    const baseDir = await pluginDataDir(payload.pluginId)
    const resolved = resolveUnder(baseDir, payload.path || '.')
    await assertRealpathUnder(baseDir, resolved)
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other',
    }))
  })
  ipcMain.handle('leeos.fs.delete', async (_event, payload: { pluginId: string; path: string }) => {
    const baseDir = await pluginDataDir(payload.pluginId)
    const resolved = resolveUnder(baseDir, payload.path)
    try {
      const stat = await fs.lstat(resolved)
      if (stat.isSymbolicLink()) {
        await fs.rm(resolved, { force: true })
        return
      }
      await assertRealpathUnder(baseDir, resolved)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code !== 'ENOENT') {
        throw error
      }
    }
    await fs.rm(resolved, { recursive: true, force: true })
  })
  ipcMain.handle('leeos.fs.openDir', async (_event, payload: { pluginId: string; path: string }) => {
    try {
      const baseDir = await pluginDataDir(payload.pluginId)
      const targetPath = typeof payload.path === 'string' && payload.path.trim().length > 0 ? payload.path : '.'
      const resolved = resolveUnder(baseDir, targetPath)
      await assertNoSymlinkTraversal(baseDir, resolved)
      await ensureDir(resolved)
      await assertRealpathUnder(baseDir, resolved)
      const result = await shell.openPath(resolved)
      return result === ''
    } catch (error) {
      if (isDev) {
        const message = error instanceof Error ? error.message : String(error ?? 'unknown error')
        console.warn(`[LeeOS] openDir failed: ${message}`)
      }
      return false
    }
  })
  ipcMain.handle('leeos.fs.openFile', async (_event, payload: { pluginId: string; path: string }) => {
    try {
      const baseDir = await pluginDataDir(payload.pluginId)
      const targetPath = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (!targetPath) {
        return false
      }
      const resolved = resolveUnder(baseDir, targetPath)
      await assertNoSymlinkTraversal(baseDir, path.dirname(resolved))
      const stat = await fs.lstat(resolved)
      if (stat.isSymbolicLink() || !stat.isFile()) {
        return false
      }
      await assertRealpathUnder(baseDir, resolved)
      const result = await shell.openPath(resolved)
      return result === ''
    } catch (error) {
      if (isDev) {
        const message = error instanceof Error ? error.message : String(error ?? 'unknown error')
        console.warn(`[LeeOS] openFile failed: ${message}`)
      }
      return false
    }
  })
  ipcMain.handle('leeos.system.openExternal', async (_event, payload: { url: string }) => {
    try {
      const rawUrl = typeof payload.url === 'string' ? payload.url.trim() : ''
      if (!rawUrl) {
        return false
      }
      const parsed = new URL(rawUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false
      }
      await shell.openExternal(parsed.toString())
      return true
    } catch (error) {
      if (isDev) {
        const message = error instanceof Error ? error.message : String(error ?? 'unknown error')
        console.warn(`[LeeOS] openExternal failed: ${message}`)
      }
      return false
    }
  })
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

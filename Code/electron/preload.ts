import { contextBridge, ipcRenderer } from 'electron'

const readAppVersion = () => {
  try {
    const raw = ipcRenderer.sendSync('leeos.app.getVersion')
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : String(raw ?? '0.0.0')
  } catch {
    return '0.0.0'
  }
}

contextBridge.exposeInMainWorld('LeeOS', {
  version: readAppVersion(),
  plugins: {
    list: () => ipcRenderer.invoke('leeos.plugins.list'),
  },
  fs: {
    readText: (pluginId: string, filePath: string) =>
      ipcRenderer.invoke('leeos.fs.readText', { pluginId, path: filePath }),
    writeText: (pluginId: string, filePath: string, content: string) =>
      ipcRenderer.invoke('leeos.fs.writeText', { pluginId, path: filePath, content }),
    readJson: (pluginId: string, filePath: string) =>
      ipcRenderer.invoke('leeos.fs.readJson', { pluginId, path: filePath }),
    writeJson: (pluginId: string, filePath: string, value: unknown) =>
      ipcRenderer.invoke('leeos.fs.writeJson', { pluginId, path: filePath, value }),
    readDir: (pluginId: string, directoryPath = '.') =>
      ipcRenderer.invoke('leeos.fs.readDir', { pluginId, path: directoryPath }),
    delete: (pluginId: string, targetPath: string) =>
      ipcRenderer.invoke('leeos.fs.delete', { pluginId, path: targetPath }),
    openDir: (pluginId: string, directoryPath = '.') =>
      ipcRenderer.invoke('leeos.fs.openDir', { pluginId, path: directoryPath }),
    openFile: (pluginId: string, filePath: string) =>
      ipcRenderer.invoke('leeos.fs.openFile', { pluginId, path: filePath }),
  },
  system: {
    openExternal: (url: string) => ipcRenderer.invoke('leeos.system.openExternal', { url }),
  },
})

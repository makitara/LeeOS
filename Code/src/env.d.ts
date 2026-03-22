export {}

type LeeOSFsDirEntry = {
  name: string
  kind: 'file' | 'dir' | 'other'
}

declare global {
  interface Window {
    LeeOS: {
      version: string
      plugins: {
        list: () => Promise<PluginEntry[]>
      }
      fs: {
        readText: (pluginId: string, filePath: string) => Promise<string>
        writeText: (pluginId: string, filePath: string, content: string) => Promise<void>
        readJson: <T = unknown>(pluginId: string, filePath: string) => Promise<T>
        writeJson: (pluginId: string, filePath: string, value: unknown) => Promise<void>
        readDir: (pluginId: string, directoryPath?: string) => Promise<LeeOSFsDirEntry[]>
        delete: (pluginId: string, targetPath: string) => Promise<void>
        openDir: (pluginId: string, directoryPath?: string) => Promise<boolean>
        openFile: (pluginId: string, filePath: string) => Promise<boolean>
      }
      system: {
        openExternal: (url: string) => Promise<boolean>
      }
    }
  }
}

export type PluginEntry = {
  id: string
  name: string
  version: string
  description?: string
  entryUrl?: string
  entry?: string
  icon?: string
  iconUrl?: string
  category?: string
  order?: number
}

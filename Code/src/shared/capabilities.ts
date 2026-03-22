export const LEEOS_METHOD = {
  pluginsList: 'LeeOS.plugins.list',
  fsReadText: 'LeeOS.fs.readText',
  fsWriteText: 'LeeOS.fs.writeText',
  fsReadJson: 'LeeOS.fs.readJson',
  fsWriteJson: 'LeeOS.fs.writeJson',
  fsReadDir: 'LeeOS.fs.readDir',
  fsDelete: 'LeeOS.fs.delete',
  fsOpenDir: 'LeeOS.fs.openDir',
  fsOpenFile: 'LeeOS.fs.openFile',
} as const

export type LeeOSMethod = (typeof LEEOS_METHOD)[keyof typeof LEEOS_METHOD]

export const LEEOS_FS_CAPABILITIES = {
  openDir: true,
  openFile: true,
} as const

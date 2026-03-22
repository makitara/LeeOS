import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const sourceIcon = path.join(rootDir, 'public', 'icon.png')
const buildDir = path.join(rootDir, 'build')
const iconsetDir = path.join(buildDir, 'icon.iconset')
const outputIcns = path.join(buildDir, 'icon.icns')

const iconEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

const buildIcon = async () => {
  if (process.platform !== 'darwin') {
    console.log('[build:icon] Skip: macOS only.')
    return
  }

  await fs.access(sourceIcon)
  await fs.mkdir(buildDir, { recursive: true })
  await fs.rm(iconsetDir, { recursive: true, force: true })
  await fs.mkdir(iconsetDir, { recursive: true })

  for (const [fileName, size] of iconEntries) {
    const outputPath = path.join(iconsetDir, fileName)
    await execFileAsync('sips', ['-z', String(size), String(size), sourceIcon, '--out', outputPath])
  }

  await execFileAsync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcns])
  await fs.rm(iconsetDir, { recursive: true, force: true })
  console.log(`[build:icon] Generated ${outputIcns}`)
}

void buildIcon().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[build:icon] Failed: ${message}`)
  process.exit(1)
})

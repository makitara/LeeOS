import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const codeRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(codeRoot, '..')

const cleanupTargets = [
  'dist',
  'dist-electron',
  'release',
  '.cache',
  '.dev-runtime',
  path.join('build', 'icon.icns'),
  path.join('build', 'icon.iconset'),
]

const removeIfExists = async (targetPath) => {
  await fs.rm(targetPath, { recursive: true, force: true })
}

const main = async () => {
  await Promise.all(
    cleanupTargets.map((relativePath) => removeIfExists(path.join(codeRoot, relativePath))),
  )

  await execFileAsync('find', [projectRoot, '-name', '.DS_Store', '-type', 'f', '-delete'])
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[clean] Failed: ${message}`)
  process.exit(1)
})

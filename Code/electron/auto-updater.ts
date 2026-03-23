import { app, dialog, shell, type BrowserWindow, type MessageBoxOptions } from 'electron'

const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/makitara/LeeOS/releases?per_page=12'

type WindowResolver = () => BrowserWindow | null

type GitHubReleaseAsset = {
  name?: string
  browser_download_url?: string
}

type GitHubRelease = {
  tag_name?: string
  name?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
  assets?: GitHubReleaseAsset[]
}

type ParsedVersion = {
  numbers: number[]
  prerelease: string[]
}

type ReleaseCandidate = {
  version: string
  releaseUrl: string
  downloadUrl: string
}

let isConfigured = false
let activeCheck: Promise<void> | null = null
let updateCheckTimer: NodeJS.Timeout | null = null
let promptedVersion = ''

const supportsUpdateChecks = () => process.platform === 'darwin' && app.isPackaged

const toMessageText = (value: unknown) => {
  if (value instanceof Error) return value.message
  return String(value ?? 'Unknown error')
}

const showMessageBox = (getWindow: WindowResolver, options: MessageBoxOptions) => {
  const owner = getWindow()
  return owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options)
}

const clearAutoUpdateTimer = () => {
  if (!updateCheckTimer) return
  clearInterval(updateCheckTimer)
  updateCheckTimer = null
}

const scheduleAutoUpdateChecks = (getWindow: WindowResolver) => {
  clearAutoUpdateTimer()
  updateCheckTimer = setInterval(() => {
    void runUpdateCheck({ manual: false, getWindow })
  }, AUTO_UPDATE_CHECK_INTERVAL_MS)
}

const normalizeVersion = (value: string) => value.trim().replace(/^v/i, '')

const parseVersion = (value: string): ParsedVersion | null => {
  const normalized = normalizeVersion(value)
  if (!normalized) return null
  const [mainPart, prereleasePart = ''] = normalized.split('-', 2)
  const numbers = mainPart.split('.').map((segment) => Number.parseInt(segment, 10))
  if (!numbers.length || numbers.some((segment) => Number.isNaN(segment))) {
    return null
  }
  const prerelease = prereleasePart
    ? prereleasePart.split('.').map((segment) => segment.trim()).filter(Boolean)
    : []
  return { numbers, prerelease }
}

const compareIdentifiers = (left: string, right: string) => {
  const leftNumber = Number.parseInt(left, 10)
  const rightNumber = Number.parseInt(right, 10)
  const leftIsNumber = String(leftNumber) === left
  const rightIsNumber = String(rightNumber) === right
  if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber
  if (leftIsNumber) return -1
  if (rightIsNumber) return 1
  return left.localeCompare(right)
}

const compareVersions = (leftRaw: string, rightRaw: string) => {
  const left = parseVersion(leftRaw)
  const right = parseVersion(rightRaw)
  if (!left || !right) return normalizeVersion(leftRaw).localeCompare(normalizeVersion(rightRaw))

  const maxLength = Math.max(left.numbers.length, right.numbers.length)
  for (let index = 0; index < maxLength; index += 1) {
    const diff = (left.numbers[index] || 0) - (right.numbers[index] || 0)
    if (diff !== 0) return diff
  }

  if (!left.prerelease.length && !right.prerelease.length) return 0
  if (!left.prerelease.length) return 1
  if (!right.prerelease.length) return -1

  const prereleaseLength = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftIdentifier = left.prerelease[index]
    const rightIdentifier = right.prerelease[index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1
    const diff = compareIdentifiers(leftIdentifier, rightIdentifier)
    if (diff !== 0) return diff
  }
  return 0
}

const pickMacAsset = (assets: GitHubReleaseAsset[]) => {
  const macAssets = assets
    .map((asset) => ({
      name: typeof asset.name === 'string' ? asset.name.trim() : '',
      url: typeof asset.browser_download_url === 'string' ? asset.browser_download_url.trim() : '',
    }))
    .filter((asset) => asset.name && asset.url)
    .filter((asset) => asset.name.endsWith('.dmg') || asset.name.endsWith('.zip'))

  if (!macAssets.length) return null

  const preferredArchToken = process.arch === 'arm64' ? 'arm64' : 'x64'
  const preferred = macAssets.find((asset) => asset.name.includes(preferredArchToken) && asset.name.endsWith('.dmg'))
    || macAssets.find((asset) => asset.name.includes(preferredArchToken) && asset.name.endsWith('.zip'))
    || macAssets.find((asset) => asset.name.endsWith('.dmg'))
    || macAssets[0]

  return preferred?.url || null
}

const fetchLatestReleaseCandidate = async (): Promise<ReleaseCandidate | null> => {
  const response = await fetch(GITHUB_RELEASES_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `${app.name}/${app.getVersion()}`,
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub release check failed (${response.status})`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('GitHub release payload was invalid')
  }

  const allowPrerelease = app.getVersion().includes('-')
  const currentVersion = app.getVersion()

  let bestCandidate: ReleaseCandidate | null = null

  for (const entry of payload as GitHubRelease[]) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.draft) continue
    if (!allowPrerelease && entry.prerelease) continue

    const version = normalizeVersion(typeof entry.tag_name === 'string' ? entry.tag_name : '')
    const releaseUrl = typeof entry.html_url === 'string' ? entry.html_url.trim() : ''
    const downloadUrl = pickMacAsset(Array.isArray(entry.assets) ? entry.assets : [])

    if (!version || !releaseUrl || !downloadUrl) continue
    if (compareVersions(version, currentVersion) <= 0) continue

    if (!bestCandidate || compareVersions(version, bestCandidate.version) > 0) {
      bestCandidate = { version, releaseUrl, downloadUrl }
    }
  }

  return bestCandidate
}

const promptForUpdate = async ({
  candidate,
  getWindow,
}: {
  candidate: ReleaseCandidate
  getWindow: WindowResolver
}) => {
  const result = await showMessageBox(getWindow, {
    type: 'info',
    buttons: ['Download Update', 'View Release', 'Later'],
    defaultId: 0,
    cancelId: 2,
    message: `LeeOS ${candidate.version} is available.`,
    detail: 'LeeOS will open the download page in your default browser. Replace the current app in Applications after downloading the new build.',
  })

  if (result.response === 0) {
    await shell.openExternal(candidate.downloadUrl)
    return
  }

  if (result.response === 1) {
    await shell.openExternal(candidate.releaseUrl)
  }
}

const runUpdateCheck = async ({
  manual,
  getWindow,
}: {
  manual: boolean
  getWindow: WindowResolver
}) => {
  if (!supportsUpdateChecks()) {
    if (manual) {
      await showMessageBox(getWindow, {
        type: 'info',
        message: 'Update checks are unavailable in this build.',
        detail: 'LeeOS only checks GitHub Releases from packaged macOS builds.',
      })
    }
    return
  }

  if (activeCheck) {
    if (manual) {
      await showMessageBox(getWindow, {
        type: 'info',
        message: 'LeeOS is already checking for updates.',
      })
    }
    return activeCheck
  }

  activeCheck = (async () => {
    try {
      const candidate = await fetchLatestReleaseCandidate()
      if (!candidate) {
        if (manual) {
          await showMessageBox(getWindow, {
            type: 'info',
            message: 'LeeOS is already up to date.',
          })
        }
        return
      }

      if (!manual && promptedVersion === candidate.version) {
        return
      }

      promptedVersion = candidate.version
      await promptForUpdate({ candidate, getWindow })
    } catch (error) {
      if (manual) {
        await showMessageBox(getWindow, {
          type: 'error',
          message: 'Unable to check for updates.',
          detail: toMessageText(error),
        })
      } else {
        console.warn(`[LeeOS] update check failed: ${toMessageText(error)}`)
      }
    } finally {
      activeCheck = null
    }
  })()

  return activeCheck
}

export const initAutoUpdater = ({ getWindow }: { getWindow: WindowResolver }) => {
  if (isConfigured || !supportsUpdateChecks()) return
  isConfigured = true
  scheduleAutoUpdateChecks(getWindow)
  void runUpdateCheck({ manual: false, getWindow })
  app.once('before-quit', clearAutoUpdateTimer)
}

export const checkForUpdatesManually = ({ getWindow }: { getWindow: WindowResolver }) => {
  return runUpdateCheck({ manual: true, getWindow })
}

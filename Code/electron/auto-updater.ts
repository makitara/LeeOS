import { app, dialog, type BrowserWindow, type MessageBoxOptions } from 'electron'
import { autoUpdater } from 'electron-updater'

const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

type WindowResolver = () => BrowserWindow | null

let isConfigured = false
let activeCheck: Promise<unknown> | null = null
let activeCheckIsManual = false
let updateCheckTimer: NodeJS.Timeout | null = null
let promptedDownloadedVersion = ''

const supportsAutoUpdates = () => process.platform === 'darwin' && app.isPackaged

const toMessageText = (value: unknown) => {
  if (value instanceof Error) return value.message
  return String(value ?? 'Unknown error')
}

const showMessageBox = (getWindow: WindowResolver, options: MessageBoxOptions) => {
  const owner = getWindow()
  return owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options)
}

const versionLabel = (info?: { version?: string | null }) => {
  const value = typeof info?.version === 'string' ? info.version.trim() : ''
  return value || ''
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

const runUpdateCheck = async ({
  manual,
  getWindow,
}: {
  manual: boolean
  getWindow: WindowResolver
}) => {
  if (!supportsAutoUpdates()) {
    if (manual) {
      await showMessageBox(getWindow, {
        type: 'info',
        message: 'Automatic updates are unavailable in this build.',
        detail: 'LeeOS only checks for updates from packaged macOS releases. End-to-end auto update requires a signed release build.',
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

  activeCheckIsManual = manual
  activeCheck = autoUpdater.checkForUpdates()

  try {
    await activeCheck
  } catch (error) {
    if (manual) {
      await showMessageBox(getWindow, {
        type: 'error',
        message: 'Unable to check for updates.',
        detail: toMessageText(error),
      })
    } else {
      console.warn(`[LeeOS] auto update check failed: ${toMessageText(error)}`)
    }
  } finally {
    activeCheck = null
    activeCheckIsManual = false
  }
}

export const initAutoUpdater = ({ getWindow }: { getWindow: WindowResolver }) => {
  if (isConfigured || !supportsAutoUpdates()) return
  isConfigured = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = app.getVersion().includes('-')
  autoUpdater.allowDowngrade = false

  autoUpdater.on('error', (error) => {
    console.warn(`[LeeOS] auto updater error: ${toMessageText(error)}`)
  })

  autoUpdater.on('update-available', async (info) => {
    if (!activeCheckIsManual) return
    const nextVersion = versionLabel(info)
    await showMessageBox(getWindow, {
      type: 'info',
      message: nextVersion
        ? `LeeOS ${nextVersion} is downloading in the background.`
        : 'A new LeeOS update is downloading in the background.',
    })
  })

  autoUpdater.on('update-not-available', async () => {
    if (!activeCheckIsManual) return
    await showMessageBox(getWindow, {
      type: 'info',
      message: 'LeeOS is already up to date.',
    })
  })

  autoUpdater.on('update-downloaded', async (info) => {
    const nextVersion = versionLabel(info) || '__unknown__'
    if (promptedDownloadedVersion === nextVersion) return
    promptedDownloadedVersion = nextVersion

    const result = await showMessageBox(getWindow, {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: nextVersion === '__unknown__'
        ? 'A new LeeOS update is ready to install.'
        : `LeeOS ${nextVersion} is ready to install.`,
      detail: 'Restart LeeOS to finish applying the update.',
    })

    if (result.response === 0) {
      setImmediate(() => {
        autoUpdater.quitAndInstall()
      })
    }
  })

  scheduleAutoUpdateChecks(getWindow)
  void runUpdateCheck({ manual: false, getWindow })
  app.once('before-quit', clearAutoUpdateTimer)
}

export const checkForUpdatesManually = ({ getWindow }: { getWindow: WindowResolver }) => {
  return runUpdateCheck({ manual: true, getWindow })
}

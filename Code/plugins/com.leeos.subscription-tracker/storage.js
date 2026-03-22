;(() => {
  const createLeeOSSubscriptionTrackerStorageAPI = ({
    FILE_DATA,
    FILE_README,
    FILE_SUBS_LEGACY,
    FILE_CATS_LEGACY,
    state,
  }) => {
      const isStorageFileNotFound = (err) => {
        const msg = String(err instanceof Error ? err.message : err || '').toLowerCase()
        return msg.includes('enoent')
          || msg.includes('no such file')
          || msg.includes('not found')
          || msg.includes('cannot find')
      }

      const readLegacyJsonArray = async (path) => {
        const fsApi = window.LeeOS?.fs
        if (!fsApi) return { status: 'missing', data: [], message: '' }

        const invalid = (message) => ({
          status: 'invalid',
          data: [],
          message: message || `${path} contains invalid JSON.`,
        })

        if (typeof fsApi.readText === 'function') {
          try {
            const text = await fsApi.readText(path)
            if (typeof text !== 'string' || !text.trim()) {
              return invalid(`${path} is empty.`)
            }

            let parsed
            try {
              parsed = JSON.parse(text)
            } catch {
              return invalid(`${path} contains invalid JSON.`)
            }

            if (!Array.isArray(parsed)) return invalid(`${path} must be a JSON array.`)
            return { status: 'ok', data: parsed, message: '' }
          } catch (err) {
            if (isStorageFileNotFound(err)) return { status: 'missing', data: [], message: '' }
            return invalid(err instanceof Error ? err.message : `Failed to read ${path}.`)
          }
        }

        if (typeof fsApi.readJson === 'function') {
          try {
            const parsed = await fsApi.readJson(path)
            if (!Array.isArray(parsed)) return invalid(`${path} must be a JSON array.`)
            return { status: 'ok', data: parsed, message: '' }
          } catch (err) {
            if (isStorageFileNotFound(err)) return { status: 'missing', data: [], message: '' }
            return invalid(err instanceof Error ? err.message : `Failed to parse ${path}.`)
          }
        }

        return { status: 'missing', data: [], message: '' }
      }

      const readDataStore = async () => {
        const fsApi = window.LeeOS?.fs
        if (!fsApi) return { status: 'missing', data: null, message: '' }

        const normalizeStoreShape = (data) => {
          if (!data || typeof data !== 'object') return null
          if (!Array.isArray(data.subscriptions) || !Array.isArray(data.categories)) return null
          return {
            subscriptions: data.subscriptions,
            categories: data.categories,
          }
        }

        if (typeof fsApi.readText === 'function') {
          try {
            const text = await fsApi.readText(FILE_DATA)
            if (typeof text !== 'string' || !text.trim()) {
              return { status: 'invalid', data: null, message: `${FILE_DATA} is empty.` }
            }
            let parsed
            try {
              parsed = JSON.parse(text)
            } catch {
              return { status: 'invalid', data: null, message: `${FILE_DATA} contains invalid JSON.` }
            }
            const normalized = normalizeStoreShape(parsed)
            if (!normalized) return { status: 'invalid', data: null, message: `${FILE_DATA} has an invalid structure.` }
            return { status: 'ok', data: normalized, message: '' }
          } catch (err) {
            if (!isStorageFileNotFound(err)) {
              return { status: 'invalid', data: null, message: err instanceof Error ? err.message : `Failed to read ${FILE_DATA}.` }
            }
          }
        }

        if (typeof fsApi.readJson === 'function') {
          try {
            const parsed = await fsApi.readJson(FILE_DATA)
            const normalized = normalizeStoreShape(parsed)
            if (!normalized) return { status: 'invalid', data: null, message: `${FILE_DATA} has an invalid structure.` }
            return { status: 'ok', data: normalized, message: '' }
          } catch (err) {
            if (isStorageFileNotFound(err)) return { status: 'missing', data: null, message: '' }
            return { status: 'invalid', data: null, message: err instanceof Error ? err.message : `Failed to parse ${FILE_DATA}.` }
          }
        }

        return { status: 'missing', data: null, message: '' }
      }

      const writeStorageJson = async (path, value) => {
        const fsApi = window.LeeOS?.fs
        if (!fsApi) throw new Error('Storage API is unavailable.')
        const pretty = `${JSON.stringify(value, null, 2)}\n`
        if (typeof fsApi.writeText === 'function') {
          await fsApi.writeText(path, pretty)
          return
        }
        if (typeof fsApi.writeJson === 'function') {
          await fsApi.writeJson(path, value)
          return
        }
        throw new Error('Storage API is unavailable.')
      }

      const writeStorageReadme = async () => {
        const fsApi = window.LeeOS?.fs
        if (!fsApi || typeof fsApi.writeText !== 'function') return
        const content = [
          '# Subscription Tracker 数据目录说明',
          '',
          '## 主数据文件',
          `- \`${FILE_DATA}\``,
          '',
          '## JSON 结构',
          '- `schemaVersion`: 数据结构版本号（数字）',
          '- `updatedAt`: 最后更新时间（ISO 日期时间字符串）',
          '- `categories`: 分类数组，每项 `{ id, name }`',
          '- `subscriptions`: 订阅数组，每项包含：',
          '  - `id`, `name`, `url`, `price`, `currency`, `categoryId`, `status`',
          '  - `billingCycle`, `customDays`, `nextBillingDate`, `iconDataUrl`, `note`',
          '',
          '## 兼容旧文件',
          '若目录中仍存在以下旧文件，可以忽略：',
          `- \`${FILE_SUBS_LEGACY}\``,
          `- \`${FILE_CATS_LEGACY}\``,
          `- \`README.txt\``,
          '',
          '## 手动编辑提示',
          '- 手动修改 `tracker-data.json` 时请保持合法 JSON 格式。',
          '',
        ].join('\n')
        try {
          await fsApi.writeText(FILE_README, content)
        } catch {
          // Ignore README write failure; core data has already been saved.
        }
      }

      const cleanupLegacyStorageFiles = async () => {
        const fsApi = window.LeeOS?.fs
        if (!fsApi || typeof fsApi.delete !== 'function') return
        const files = [FILE_SUBS_LEGACY, FILE_CATS_LEGACY, 'README.txt']
        for (const path of files) {
          try {
            await fsApi.delete(path)
          } catch {
            // Ignore delete failure for non-existent legacy files.
          }
        }
      }

      const saveAll = async () => {
        await writeStorageJson(FILE_DATA, {
          schemaVersion: 2,
          updatedAt: new Date().toISOString(),
          categories: state.categories,
          subscriptions: state.subscriptions,
        })
      }

      const cloneStoreItems = (items) => items.map((item) => ({ ...item }))

      const captureStoreSnapshot = () => ({
        categories: cloneStoreItems(state.categories),
        subscriptions: cloneStoreItems(state.subscriptions),
        activeCategory: state.activeCategory,
      })

      const restoreStoreSnapshot = (snapshot) => {
        if (!snapshot) return
        state.categories = cloneStoreItems(snapshot.categories || [])
        state.subscriptions = cloneStoreItems(snapshot.subscriptions || [])
        state.activeCategory = snapshot.activeCategory || 'ALL'
      }

      const runStoreTransaction = async (mutate) => {
        const snapshot = captureStoreSnapshot()
        try {
          mutate()
          await saveAll()
        } catch (err) {
          restoreStoreSnapshot(snapshot)
          throw err
        }
      }


    return {
      isStorageFileNotFound,
      readLegacyJsonArray,
      readDataStore,
      writeStorageJson,
      writeStorageReadme,
      cleanupLegacyStorageFiles,
      saveAll,
      captureStoreSnapshot,
      restoreStoreSnapshot,
      runStoreTransaction,
    }
  }

  window.createLeeOSSubscriptionTrackerStorageAPI = createLeeOSSubscriptionTrackerStorageAPI
})()

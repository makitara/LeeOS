      const trackerShared = window.LeeOSSubscriptionTrackerShared
      if (!trackerShared) {
        throw new Error('Subscription Tracker shared module is not loaded')
      }
      const {
        FILE_DATA,
        FILE_README,
        FILE_SUBS_LEGACY,
        FILE_CATS_LEGACY,
        DND_CATEGORY,
        DND_SUB,
        uid,
        todayIso,
        normalizeIsoDate,
        addDaysIso,
        esc,
        normalizeUrl,
        parseDomain,
        normalizePrice,
        normalizeCurrency,
        MAX_ICON_SIZE_BYTES,
        isAllowedIconFile,
        sanitizeIconDataUrl,
        getCachedFavicon,
        setCachedFavicon,
        fileToDataUrl,
        DEFAULT_ICON_SVG,
        defaultIconMarkup,
        daysUntil,
        resolveDateRange,
        progress,
        resolveCardStatus,
        normalizeRenewalRecord,
        summarizeRenewalHistory,
        buildRenewalDraft,
        faviconSources,
      } = trackerShared


      const state = {
        subscriptions: [],
        categories: [],
        editingId: null,
        editorDeleteArmed: false,
        editorIconDataUrl: '',
        activeCategory: 'ALL',
        searchQuery: '',
        isCategoryEditMode: false,
        renamingCategoryId: null,
        renamingCategoryDraft: '',
        pendingDeleteCategoryId: null,
        dragCategoryId: null,
        dragSubId: null,
        dragSubSnapshot: null,
        dragSubDropped: false,
        dragSubPreviewTargetId: null,
        dragSubPreviewDirty: false,
        editorOriginSubId: '',
        editorTransitionBusy: false,
        pendingEditorCloseJob: null,
        boardHasBootAnimated: false,
        categoryListHasBootAnimated: false,
        pendingCategoryPulseKey: '',
        renewingId: null,
        renewalEditingRecordId: null,
        pendingRenewalDeleteId: null,
      }

      const $ = (id) => document.getElementById(id)
      const dom = {
        board: $('board'),
        newSubBtn: $('newSubBtn'),
        openDataDirBtn: $('openDataDirBtn'),
        searchInput: $('searchInput'),
        categoryList: $('categoryList'),
        openAddCategoryBtn: $('openAddCategoryBtn'),
        editCategoriesBtn: $('editCategoriesBtn'),
        categoryCreator: $('categoryCreator'),
        categoryCreatorForm: $('categoryCreatorForm'),
        fNewCategoryName: $('fNewCategoryName'),
        categoryCreatorError: $('categoryCreatorError'),
        cancelCategoryBtn: $('cancelCategoryBtn'),
        editor: $('editor'),
        editorForm: $('editorForm'),
        editorTitle: $('editorTitle'),
        editorUtilityActions: $('editorUtilityActions'),
        editorOpenUrlBtn: $('editorOpenUrlBtn'),
        editorRenewBtn: $('editorRenewBtn'),
        editorError: $('editorError'),
        editorSaveBtn: $('editorSaveBtn'),
        deleteSubBtn: $('deleteSubBtn'),
        fName: $('fName'), fUrl: $('fUrl'), fPrice: $('fPrice'), fCurrency: $('fCurrency'),
        fCategory: $('fCategory'), fStatus: $('fStatus'),
        fStartDate: $('fStartDate'), fEndDate: $('fEndDate'),
        fNote: $('fNote'), cancelBtn: $('cancelBtn'),
        fIconUpload: $('fIconUpload'),
        chooseIconBtn: $('chooseIconBtn'),
        iconPreview: $('iconPreview'),
        iconHelp: $('iconHelp'),
        clearIconBtn: $('clearIconBtn'),
        editorRenewalSection: $('editorRenewalSection'),
        editorRenewalEmpty: $('editorRenewalEmpty'),
        editorRenewalList: $('editorRenewalList'),
        createCategoryBtn: $('createCategoryBtn'),
        globalNotice: $('globalNotice'),
        renewalEditor: $('renewalEditor'),
        renewalEditorForm: $('renewalEditorForm'),
        renewalEditorTitle: $('renewalEditorTitle'),
        renewalEditorContext: $('renewalEditorContext'),
        renewalEditorError: $('renewalEditorError'),
        renewalSaveBtn: $('renewalSaveBtn'),
        cancelRenewalBtn: $('cancelRenewalBtn'),
        fRenewalAmount: $('fRenewalAmount'),
        fRenewalCurrency: $('fRenewalCurrency'),
        fRenewalPaidAt: $('fRenewalPaidAt'),
        fRenewalStartDate: $('fRenewalStartDate'),
        fRenewalEndDate: $('fRenewalEndDate'),
      }
      let globalNoticeTimer = 0
      let boardResizeTimer = 0

      const formatMoneyLabel = (amount, currency) => {
        const value = normalizePrice(amount)
        if (value === null) return 'Not set'
        return `${normalizeCurrency(currency)} ${value.toFixed(2)}`
      }

      const CARD_ICON = Object.freeze({
        renewalPrice: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 7.5h16'></path><path d='M6.5 12h11'></path><path d='M7 16.5h4'></path><rect x='3' y='5' width='18' height='14' rx='3'></rect></svg>",
        totalSpent: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M7 7h10'></path><path d='M7 12h10'></path><path d='M7 17h10'></path><rect x='4' y='4' width='16' height='4' rx='2'></rect><rect x='4' y='9' width='16' height='4' rx='2'></rect><rect x='4' y='14' width='16' height='4' rx='2'></rect></svg>",
        lastPaid: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M7 4h10l3 3v13H4V4z'></path><path d='M14 4v4h4'></path><path d='M8 12h8'></path><path d='M8 16h5'></path></svg>",
        startDate: "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='4' y='5' width='16' height='15' rx='3'></rect><path d='M8 3v4'></path><path d='M16 3v4'></path><path d='M4 10h16'></path><circle cx='9' cy='14' r='1.5' fill='currentColor' stroke='none'></circle></svg>",
        endDate: "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='4' y='5' width='16' height='15' rx='3'></rect><path d='M8 3v4'></path><path d='M16 3v4'></path><path d='M4 10h16'></path><path d='M8.5 15.5l2 2 4.5-5'></path></svg>",
        daysLeft: "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='8'></circle><path d='M12 8v5'></path><path d='M12 12h3'></path></svg>",
      })

      const renderEditorIconPreview = () => {
        const customIcon = sanitizeIconDataUrl(state.editorIconDataUrl)
        const domain = parseDomain(dom.fUrl.value)
        dom.iconPreview.innerHTML = ''

        if (customIcon) {
          dom.iconPreview.innerHTML = `<img src="${esc(customIcon)}" alt="Custom icon">`
          dom.iconHelp.textContent = 'Custom icon selected.'
          dom.clearIconBtn.hidden = false
          dom.clearIconBtn.disabled = false
          return
        }

        dom.clearIconBtn.hidden = true
        dom.clearIconBtn.disabled = true
        if (domain) {
          const cached = getCachedFavicon(domain)
          if (cached === null) {
            dom.iconPreview.innerHTML = defaultIconMarkup()
            dom.iconHelp.textContent = 'URL icon unavailable, using default icon.'
            return
          }

          dom.iconHelp.textContent = `Using icon from ${domain}.`
          if (typeof cached === 'string') {
            const img = document.createElement('img')
            img.addEventListener('error', () => {
              setCachedFavicon(domain, null)
              dom.iconPreview.innerHTML = defaultIconMarkup()
              dom.iconHelp.textContent = 'URL icon unavailable, using default icon.'
            }, { once: true })
            dom.iconPreview.appendChild(img)
            img.src = cached
            return
          }

          const img = document.createElement('img')
          const srcs = faviconSources(domain, dom.fUrl.value)
          let i = 0
          const fallback = () => {
            setCachedFavicon(domain, null)
            dom.iconPreview.innerHTML = defaultIconMarkup()
            dom.iconHelp.textContent = 'URL icon unavailable, using default icon.'
          }
          const next = () => {
            if (i >= srcs.length) {
              fallback()
              return
            }
            img.src = srcs[i++]
          }
          img.addEventListener('load', () => {
            const resolved = String(img.currentSrc || img.src || '')
            if (resolved) setCachedFavicon(domain, resolved)
          }, { once: true })
          img.addEventListener('error', next)
          dom.iconPreview.appendChild(img)
          next()
          return
        }

        dom.iconHelp.textContent = 'No URL configured, using default icon.'
        dom.iconPreview.innerHTML = defaultIconMarkup()
      }

      const createTrackerStorageApi = window.createLeeOSSubscriptionTrackerStorageAPI
      if (!createTrackerStorageApi) {
        throw new Error('Subscription Tracker storage module is not loaded')
      }
      const {
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
      } = createTrackerStorageApi({
        FILE_DATA,
        FILE_README,
        FILE_SUBS_LEGACY,
        FILE_CATS_LEGACY,
        state,
      })


      const persistDragPreviewOrRollback = async (snapshotIds) => {
        if (!state.dragSubPreviewDirty) return
        const rollbackSnapshot = Array.isArray(snapshotIds) ? snapshotIds.slice() : null
        try {
          await saveAll()
        } catch (err) {
          restoreSubscriptionOrderFromSnapshot(rollbackSnapshot)
          throw err
        }
      }

      const normalizeCategoryName = (v) => String(v || '').trim().slice(0, 30)

      const ensureCategoryByName = (name) => {
        const normalized = normalizeCategoryName(name)
        if (!normalized) return ''
        const existing = state.categories.find((c) => c.name.toLowerCase() === normalized.toLowerCase())
        if (existing) return existing.id
        const id = uid('cat')
        state.categories.push({ id, name: normalized })
        return id
      }

      const categoryNameById = (id) => {
        if (!id) return 'Uncategorized'
        const found = state.categories.find((c) => c.id === id)
        return found ? found.name : 'Uncategorized'
      }

      const hasDndType = (dataTransfer, type) => Array.from(dataTransfer?.types || []).includes(type)

      const setFormError = (el, message) => {
        if (!el) return
        if (!message) {
          el.hidden = true
          el.textContent = ''
          return
        }
        el.hidden = false
        el.textContent = message
      }

      const hideGlobalNotice = () => {
        const el = dom.globalNotice
        if (!(el instanceof HTMLElement)) return
        el.classList.remove('show')
        window.clearTimeout(globalNoticeTimer)
        globalNoticeTimer = window.setTimeout(() => {
          el.hidden = true
          el.textContent = ''
          delete el.dataset.tone
        }, 160)
      }

      const showGlobalNotice = (message, tone = 'error') => {
        const el = dom.globalNotice
        if (!(el instanceof HTMLElement)) return
        window.clearTimeout(globalNoticeTimer)
        el.hidden = false
        el.textContent = String(message || '')
        el.dataset.tone = tone
        requestAnimationFrame(() => {
          el.classList.add('show')
        })
        globalNoticeTimer = window.setTimeout(() => {
          hideGlobalNotice()
        }, 2600)
      }

      const createEditorValidationError = (field, message) => {
        const err = new Error(message)
        err.field = field
        return err
      }

      const setFieldInlineError = (input, message) => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return
        if (!input.dataset.basePlaceholder) input.dataset.basePlaceholder = input.placeholder || ''
        input.classList.add('field-input-error')
        input.setAttribute('aria-invalid', 'true')
        input.title = message
        if (input instanceof HTMLInputElement && input.type !== 'date' && !input.value) {
          input.placeholder = message
        }
      }

      const clearFieldInlineError = (input) => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return
        input.classList.remove('field-input-error')
        input.removeAttribute('aria-invalid')
        input.title = ''
        if (input.dataset.basePlaceholder !== undefined) {
          input.placeholder = input.dataset.basePlaceholder
        }
      }

      const clearEditorInlineErrors = () => {
        clearFieldInlineError(dom.fName)
        clearFieldInlineError(dom.fUrl)
        clearFieldInlineError(dom.fPrice)
        clearFieldInlineError(dom.fStartDate)
        clearFieldInlineError(dom.fEndDate)
      }

      const applyEditorInlineError = (field, message) => {
        const targets = {
          name: dom.fName,
          url: dom.fUrl,
          price: dom.fPrice,
          startDate: dom.fStartDate,
          endDate: dom.fEndDate,
        }
        const target = targets[field]
        if (!target) return false
        setFieldInlineError(target, message)
        target.focus()
        return true
      }

      const setButtonPending = (btn, pendingText, isPending) => {
        if (!(btn instanceof HTMLButtonElement)) return
        if (!btn.dataset.baseLabel) btn.dataset.baseLabel = btn.textContent || ''
        btn.disabled = isPending
        btn.dataset.pending = isPending ? 'true' : 'false'
        btn.setAttribute('aria-busy', isPending ? 'true' : 'false')
        btn.textContent = isPending ? pendingText : (btn.dataset.baseLabel || '')
      }

      const resetDeleteButtonState = () => {
        state.editorDeleteArmed = false
        const btn = dom.deleteSubBtn
        if (!(btn instanceof HTMLButtonElement)) return
        btn.textContent = 'Delete'
        btn.dataset.baseLabel = 'Delete'
      }

      const setButtonLabel = (btn, text) => {
        if (!(btn instanceof HTMLButtonElement)) return
        btn.dataset.baseLabel = text
        btn.textContent = text
      }

      const syncSubscriptionToLatestRenewal = (subscription, { activate = false, clearWhenEmpty = false } = {}) => {
        if (!subscription) return
        const entries = summarizeRenewalHistory(subscription.renewalHistory).entries
        const latest = entries[0]
        if (!latest) {
          if (clearWhenEmpty) {
            subscription.startDate = ''
            subscription.endDate = ''
          }
          return
        }
        subscription.startDate = latest.startDate
        subscription.endDate = latest.endDate
        subscription.currency = latest.currency
        if (activate) subscription.status = 'active'
      }

      const resetRenewalEditor = () => {
        state.renewingId = null
        state.renewalEditingRecordId = null
        setFormError(dom.renewalEditorError, '')
        setButtonLabel(dom.renewalSaveBtn, 'Save Renewal')
        setButtonPending(dom.renewalSaveBtn, 'Saving...', false)
        dom.renewalEditorForm?.reset()
        dom.fRenewalCurrency.value = 'CNY'
        dom.fRenewalPaidAt.value = todayIso()
        dom.fRenewalStartDate.value = ''
        dom.fRenewalEndDate.value = ''
        dom.renewalEditorContext.textContent = ''
      }

      const closeRenewalEditor = () => {
        resetRenewalEditor()
        if (dom.renewalEditor.open) {
          dom.renewalEditor.close()
        }
      }

      const presentRenewalEditor = () => {
        try {
          dom.renewalEditor.showModal()
        } catch {
          if (!dom.renewalEditor.open) {
            dom.renewalEditor.show()
          }
        }
      }

      const syncEditorUtilityActions = (subscription) => {
        const wrap = dom.editorUtilityActions
        const openBtn = dom.editorOpenUrlBtn
        const renewBtn = dom.editorRenewBtn
        if (!(wrap instanceof HTMLElement) || !(openBtn instanceof HTMLButtonElement) || !(renewBtn instanceof HTMLButtonElement)) {
          return
        }
        if (!subscription?.id) {
          wrap.hidden = true
          openBtn.hidden = true
          renewBtn.hidden = true
          return
        }
        wrap.hidden = false
        openBtn.hidden = !subscription.url
        renewBtn.hidden = false
      }

      const openRenewalEditor = (subscription) => {
        if (!subscription?.id) return
        const draft = buildRenewalDraft(subscription)
        resetRenewalEditor()
        state.renewingId = subscription.id
        state.pendingRenewalDeleteId = null
        dom.renewalEditorTitle.textContent = `Renew ${subscription.name}`
        dom.renewalEditorContext.textContent = `Record a payment and update the billing window for ${subscription.name}.`
        dom.fRenewalAmount.value = draft.amount === null ? '' : String(draft.amount)
        dom.fRenewalCurrency.value = draft.currency
        dom.fRenewalPaidAt.value = draft.paidAt
        dom.fRenewalStartDate.value = draft.startDate
        dom.fRenewalEndDate.value = draft.endDate
        presentRenewalEditor()
      }

      const openRenewalRecordEditor = (subscription, record) => {
        if (!subscription?.id || !record?.id) return
        resetRenewalEditor()
        state.renewingId = subscription.id
        state.renewalEditingRecordId = record.id
        state.pendingRenewalDeleteId = null
        dom.renewalEditorTitle.textContent = `Edit renewal for ${subscription.name}`
        dom.renewalEditorContext.textContent = 'Update the paid amount and billing window for this renewal record.'
        setButtonLabel(dom.renewalSaveBtn, 'Save Changes')
        dom.fRenewalAmount.value = String(record.amount)
        dom.fRenewalCurrency.value = normalizeCurrency(record.currency)
        dom.fRenewalPaidAt.value = record.paidAt
        dom.fRenewalStartDate.value = record.startDate
        dom.fRenewalEndDate.value = record.endDate
        presentRenewalEditor()
      }

      const collectRenewalForm = () => {
        const amount = normalizePrice(dom.fRenewalAmount.value)
        const currency = normalizeCurrency(dom.fRenewalCurrency.value)
        const paidAt = normalizeIsoDate(dom.fRenewalPaidAt.value, todayIso())
        const startDate = normalizeIsoDate(dom.fRenewalStartDate.value, '')
        const endDate = normalizeIsoDate(dom.fRenewalEndDate.value, '')
        if (amount === null) throw createEditorValidationError('renewalAmount', 'Paid amount is required')
        if (!startDate) throw createEditorValidationError('renewalStartDate', 'Start date is required')
        if (!endDate) throw createEditorValidationError('renewalEndDate', 'End date is required')
        if (startDate > endDate) {
          throw createEditorValidationError('renewalEndDate', 'End date must be after start date')
        }
        return {
          id: state.renewalEditingRecordId || uid('renew'),
          paidAt,
          amount,
          currency,
          startDate,
          endDate,
        }
      }

      const renderEditorRenewalHistory = (subscriptionId = state.editingId) => {
        const section = dom.editorRenewalSection
        const empty = dom.editorRenewalEmpty
        const list = dom.editorRenewalList
        if (!(section instanceof HTMLElement) || !(empty instanceof HTMLElement) || !(list instanceof HTMLElement)) {
          return
        }

        const subscription = state.subscriptions.find((item) => item.id === subscriptionId)
        if (!subscription?.id) {
          section.hidden = true
          empty.hidden = true
          list.innerHTML = ''
          state.pendingRenewalDeleteId = null
          return
        }

        const entries = summarizeRenewalHistory(subscription.renewalHistory).entries
        section.hidden = false
        empty.hidden = entries.length > 0
        if (!entries.length) {
          list.innerHTML = ''
          return
        }

        list.innerHTML = entries.map((entry, index) => {
          const amountLabel = formatMoneyLabel(entry.amount, entry.currency)
          const periodLabel = `${entry.startDate} to ${entry.endDate}`
          const deleteArmed = state.pendingRenewalDeleteId === entry.id
          return `
            <article class="renewal-row ${index === 0 ? 'is-current' : ''}" data-renewal-id="${esc(entry.id)}">
              <div class="renewal-row__main">
                <div class="renewal-row__line">
                  <strong>${esc(amountLabel)}</strong>
                  <span class="renewal-row__meta">${esc(entry.paidAt)}</span>
                </div>
                <div class="renewal-row__line renewal-row__line--muted">
                  <span>${esc(periodLabel)}</span>
                  ${index === 0 ? '<span class="renewal-row__badge">Current</span>' : ''}
                </div>
              </div>
              <div class="renewal-row__actions">
                <button type="button" class="renewal-row__action" data-renewal-action="edit" data-renewal-id="${esc(entry.id)}">Edit</button>
                ${deleteArmed
                  ? `
                    <button type="button" class="renewal-row__action renewal-row__action--quiet" data-renewal-action="cancel-delete" data-renewal-id="${esc(entry.id)}">Cancel</button>
                    <button type="button" class="renewal-row__action renewal-row__action--danger is-armed" data-renewal-action="confirm-delete" data-renewal-id="${esc(entry.id)}">Confirm</button>
                  `
                  : `<button type="button" class="renewal-row__action renewal-row__action--danger" data-renewal-action="delete" data-renewal-id="${esc(entry.id)}">Delete</button>`}
              </div>
            </article>
          `
        }).join('')

        list.querySelectorAll('[data-renewal-action="edit"]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement)) return
          node.addEventListener('click', () => {
            const renewalId = String(node.dataset.renewalId || '')
            const entry = entries.find((item) => item.id === renewalId)
            if (!entry) return
            openRenewalRecordEditor(subscription, entry)
          })
        })

        list.querySelectorAll('[data-renewal-action="delete"]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement)) return
          node.addEventListener('click', () => {
            const renewalId = String(node.dataset.renewalId || '')
            if (!renewalId) return
            state.pendingRenewalDeleteId = renewalId
            renderEditorRenewalHistory(subscription.id)
          })
        })

        list.querySelectorAll('[data-renewal-action="cancel-delete"]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement)) return
          node.addEventListener('click', () => {
            state.pendingRenewalDeleteId = null
            renderEditorRenewalHistory(subscription.id)
          })
        })

        list.querySelectorAll('[data-renewal-action="confirm-delete"]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement)) return
          node.addEventListener('click', async () => {
            const renewalId = String(node.dataset.renewalId || '')
            if (!renewalId) return
            state.pendingRenewalDeleteId = null
            setFormError(dom.editorError, '')
            try {
              await runStoreTransaction(() => {
                const target = state.subscriptions.find((item) => item.id === subscription.id)
                if (!target) throw new Error('Subscription not found. Reopen and try again.')
                const nextHistory = summarizeRenewalHistory(target.renewalHistory).entries
                  .filter((item) => item.id !== renewalId)
                target.renewalHistory = nextHistory
                syncSubscriptionToLatestRenewal(target, { clearWhenEmpty: true })
              })
              renderEditorRenewalHistory(subscription.id)
              renderBoard()
            } catch (err) {
              setFormError(dom.editorError, err instanceof Error ? err.message : 'Delete renewal failed.')
            }
          })
        })
      }

      const submitRenewalSave = async () => {
        setFormError(dom.renewalEditorError, '')
        let payload
        try {
          payload = collectRenewalForm()
        } catch (err) {
          setFormError(dom.renewalEditorError, err instanceof Error ? err.message : 'Save renewal failed.')
          return
        }

        const targetId = state.renewingId
        if (!targetId) {
          setFormError(dom.renewalEditorError, 'Subscription not found. Reopen and try again.')
          return
        }

        setButtonPending(dom.renewalSaveBtn, 'Saving...', true)
        try {
          await runStoreTransaction(() => {
            const target = state.subscriptions.find((subscription) => subscription.id === targetId)
            if (!target) throw new Error('Subscription not found. Reopen and try again.')
            const renewalHistory = summarizeRenewalHistory(target.renewalHistory).entries
            const nextHistory = state.renewalEditingRecordId
              ? renewalHistory.map((entry) => (entry.id === payload.id ? payload : entry))
              : [payload, ...renewalHistory]
            target.renewalHistory = summarizeRenewalHistory(nextHistory).entries
            syncSubscriptionToLatestRenewal(target, { activate: true })
            if (normalizePrice(target.price) === null) {
              target.price = payload.amount
            }
          })
          closeRenewalEditor()
          renderEditorRenewalHistory(targetId)
          renderBoard()
        } catch (err) {
          setFormError(dom.renewalEditorError, err instanceof Error ? err.message : 'Save renewal failed.')
        } finally {
          setButtonPending(dom.renewalSaveBtn, 'Saving...', false)
        }
      }

      const syncOpenDataDirButton = async () => {
        const btn = dom.openDataDirBtn
        if (!(btn instanceof HTMLButtonElement)) return
        const fsApi = window.LeeOS?.fs
        let supported = Boolean(fsApi?.openDir)

        if (supported && typeof fsApi.capabilities === 'function') {
          try {
            const caps = await fsApi.capabilities()
            if (caps && caps.openDir === false) supported = false
          } catch {
            supported = Boolean(fsApi?.openDir)
          }
        }

        btn.disabled = !supported
        btn.dataset.openDirSupported = supported ? 'true' : 'false'
        btn.title = supported ? 'Open data folder' : 'Data folder access unavailable'
      }

      const bindOpenDataDirButton = () => {
        const btn = dom.openDataDirBtn
        if (!(btn instanceof HTMLButtonElement)) return
        if (btn.dataset.boundOpenDir === 'true') return
        btn.dataset.boundOpenDir = 'true'
        btn.addEventListener('click', async () => {
          if (btn.dataset.openDirSupported === 'false') {
            showGlobalNotice('Data folder access is unavailable in this host.')
            return
          }
          const fsApi = window.LeeOS?.fs
          if (!fsApi?.openDir) {
            showGlobalNotice('Data folder access is unavailable in this host.')
            return
          }
          btn.disabled = true
          try {
            const ok = await fsApi.openDir('.')
            if (!ok) showGlobalNotice('Failed to open plugin data folder.')
          } catch {
            showGlobalNotice('Failed to open plugin data folder.')
          } finally {
            btn.disabled = false
          }
        })
      }

      const openSubscriptionUrl = async (urlLike) => {
        const url = normalizeUrl(urlLike)
        if (!url) {
          showGlobalNotice('Subscription URL is not set.')
          return
        }
        const systemApi = window.LeeOS?.system
        if (!systemApi?.openExternal) {
          showGlobalNotice('Open in browser is unavailable in this host.')
          return
        }
        const ok = await systemApi.openExternal(url)
        if (!ok) {
          showGlobalNotice('Failed to open subscription URL.')
        }
      }

      const clearCategoryDropStyles = () => {
        dom.categoryList.querySelectorAll('.cat-item').forEach((node) => {
          node.classList.remove('dragging', 'drop-before', 'drop-after')
        })
        dom.categoryList.querySelectorAll('.cat-pill').forEach((node) => {
          node.classList.remove('drop-target')
        })
      }

      const clearBoardDropStyles = () => {
        dom.board.querySelectorAll('.card').forEach((node) => {
          node.classList.remove('dragging', 'drop-before', 'drop-after')
        })
      }

      const clearCategoryRenameState = () => {
        state.renamingCategoryId = null
        state.renamingCategoryDraft = ''
      }

      const clearPendingDeleteState = () => {
        state.pendingDeleteCategoryId = null
      }

      const findCategoryRenameInput = (id) => {
        const nodes = dom.categoryList.querySelectorAll('.cat-edit-input')
        for (const node of nodes) {
          if (node instanceof HTMLInputElement && node.dataset.categoryId === id) return node
        }
        return null
      }

      const clearDragState = () => {
        state.dragCategoryId = null
        state.dragSubId = null
        state.dragSubSnapshot = null
        state.dragSubDropped = false
        state.dragSubPreviewTargetId = null
        state.dragSubPreviewDirty = false
      }

      const toggleCategoryEditMode = () => {
        state.isCategoryEditMode = !state.isCategoryEditMode
        clearCategoryRenameState()
        clearPendingDeleteState()
        clearDragState()
        clearCategoryDropStyles()
        clearBoardDropStyles()
        if (!state.isCategoryEditMode && dom.categoryCreator.open) dom.categoryCreator.close()
        renderAll()
      }

      const openCategoryRename = (id) => {
        const target = state.categories.find((c) => c.id === id)
        if (!target) return
        clearPendingDeleteState()
        state.renamingCategoryId = id
        state.renamingCategoryDraft = target.name
        renderCategories()
        const input = findCategoryRenameInput(id)
        if (input instanceof HTMLInputElement) {
          input.focus()
          input.select()
        }
      }

      const cancelCategoryRename = () => {
        clearCategoryRenameState()
        renderCategories()
      }

      const saveCategoryRename = async (id) => {
        const target = state.categories.find((c) => c.id === id)
        if (!target) {
          clearCategoryRenameState()
          renderCategories()
          return
        }

        const normalized = normalizeCategoryName(state.renamingCategoryDraft)
        if (!normalized) {
          const input = findCategoryRenameInput(id)
          if (input) setFieldInlineError(input, 'Category name is required')
          showGlobalNotice('Category name is required')
          return
        }

        const duplicated = state.categories.some((c) => c.id !== id && c.name.toLowerCase() === normalized.toLowerCase())
        if (duplicated) {
          const input = findCategoryRenameInput(id)
          if (input) setFieldInlineError(input, 'Category already exists')
          showGlobalNotice('Category already exists')
          return
        }

        try {
          await runStoreTransaction(() => {
            target.name = normalized
          })
          clearCategoryRenameState()
          clearPendingDeleteState()
          renderAll()
        } catch {
          renderCategories()
        }
      }

      const removeCategory = async (id) => {
        const target = state.categories.find((c) => c.id === id)
        if (!target) return
        try {
          await runStoreTransaction(() => {
            state.categories = state.categories.filter((c) => c.id !== id)
            for (const s of state.subscriptions) if (s.categoryId === id) s.categoryId = ''
            if (state.activeCategory === id) state.activeCategory = 'ALL'
          })
          clearCategoryRenameState()
          clearPendingDeleteState()
          renderAll()
        } catch {
          renderCategories()
        }
      }

      const moveCategoryByDrop = async (dragId, targetId, position = 'before') => {
        if (!dragId || !targetId || dragId === targetId) return
        const from = state.categories.findIndex((c) => c.id === dragId)
        const to = state.categories.findIndex((c) => c.id === targetId)
        if (from < 0 || to < 0) return

        try {
          await runStoreTransaction(() => {
            const [picked] = state.categories.splice(from, 1)
            let insertAt = to
            if (position === 'after') insertAt += 1
            if (from < insertAt) insertAt -= 1
            state.categories.splice(insertAt, 0, picked)
          })
          renderAll()
        } catch {
          renderAll()
        }
      }

      const swapSubscriptionInMemory = (dragId, targetId) => {
        if (!dragId || !targetId || dragId === targetId) return false
        const from = state.subscriptions.findIndex((s) => s.id === dragId)
        const to = state.subscriptions.findIndex((s) => s.id === targetId)
        if (from < 0 || to < 0) return false

        const tmp = state.subscriptions[from]
        state.subscriptions[from] = state.subscriptions[to]
        state.subscriptions[to] = tmp
        return true
      }

      const findBoardCardBySubId = (id) => {
        const cards = dom.board.querySelectorAll('.card[data-sub-id]')
        for (const card of cards) {
          if (!(card instanceof HTMLElement)) continue
          if (card.dataset.subId === id) return card
        }
        return null
      }

      const prefersReducedMotion = () => {
        try {
          return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        } catch {
          return false
        }
      }

      const animateEditorDialogTransition = (direction = 'in') => new Promise((resolve) => {
        if (prefersReducedMotion()) {
          resolve()
          return
        }
        const dialog = dom.editor
        const form = dom.editorForm
        if (!(dialog instanceof HTMLDialogElement) || !(form instanceof HTMLElement) || !dialog.open) {
          resolve()
          return
        }

        const className = direction === 'out' ? 'editor-exit' : 'editor-enter'
        let done = false
        const finish = () => {
          if (done) return
          done = true
          window.clearTimeout(timer)
          dialog.classList.remove('editor-enter', 'editor-exit')
          form.removeEventListener('animationend', onEnd)
          resolve()
        }
        const onEnd = (event) => {
          if (event.target !== form) return
          finish()
        }
        const timer = window.setTimeout(finish, direction === 'out' ? 260 : 300)
        dialog.classList.remove('editor-enter', 'editor-exit')
        void form.offsetWidth
        dialog.classList.add(className)
        form.addEventListener('animationend', onEnd)
      })

      const refreshEditedCardIfPossible = (subId) => {
        const id = String(subId || '')
        if (!id) return false
        const currentCard = findBoardCardBySubId(id)
        if (!(currentCard instanceof HTMLElement)) return false

        const list = filteredSubs()
        const nextIndex = list.findIndex((item) => item.id === id)
        if (nextIndex < 0) return false

        const boardIds = Array.from(dom.board.querySelectorAll('.card[data-sub-id]'))
          .map((node) => String(node instanceof HTMLElement ? node.dataset.subId || '' : ''))
          .filter(Boolean)
        if (boardIds.length !== list.length) return false
        const currentIndex = boardIds.indexOf(id)
        if (currentIndex !== nextIndex) return false

        const nextItem = list[nextIndex]
        if (!nextItem) return false
        const nextCard = renderCard(nextItem, nextIndex)
        currentCard.replaceWith(nextCard)
        return true
      }

      const closeEditorWithCardReturn = async (subId, { rerenderBoard = false, refreshCard = false } = {}) => {
        if (state.editorTransitionBusy) {
          state.pendingEditorCloseJob = {
            subId: String(subId || ''),
            rerenderBoard: Boolean(rerenderBoard),
            refreshCard: Boolean(refreshCard),
          }
          return
        }
        state.editorTransitionBusy = true
        try {
          const returnId = subId || state.editorOriginSubId
          if (dom.editor.open) {
            await animateEditorDialogTransition('out')
            dom.editor.close()
          }
          let patched = false
          if (refreshCard && returnId) {
            patched = refreshEditedCardIfPossible(returnId)
          }
          if (!patched && rerenderBoard) renderBoard()
          state.editorOriginSubId = ''
        } finally {
          state.editorTransitionBusy = false
          const pending = state.pendingEditorCloseJob
          state.pendingEditorCloseJob = null
          if (pending) {
            void closeEditorWithCardReturn(pending.subId, {
              rerenderBoard: pending.rerenderBoard,
              refreshCard: pending.refreshCard,
            })
          }
        }
      }

      const swapSiblingNodes = (leftNode, rightNode) => {
        if (!(leftNode instanceof HTMLElement) || !(rightNode instanceof HTMLElement)) return false
        if (leftNode === rightNode) return false
        const parent = leftNode.parentNode
        if (!parent || parent !== rightNode.parentNode) return false

        const leftNext = leftNode.nextSibling
        const rightNext = rightNode.nextSibling

        if (leftNext === rightNode) {
          parent.insertBefore(rightNode, leftNode)
          return true
        }
        if (rightNext === leftNode) {
          parent.insertBefore(leftNode, rightNode)
          return true
        }

        const marker = document.createComment('swap-marker')
        parent.insertBefore(marker, leftNode)
        parent.insertBefore(leftNode, rightNode)
        parent.insertBefore(rightNode, marker)
        parent.removeChild(marker)
        return true
      }

      const animateCardNodeMove = (node, beforeRect) => {
        if (!(node instanceof HTMLElement) || !beforeRect) return
        const afterRect = node.getBoundingClientRect()
        const dx = beforeRect.left - afterRect.left
        const dy = beforeRect.top - afterRect.top
        if (!dx && !dy) return

        node.style.transition = 'none'
        node.style.transform = `translate(${dx}px, ${dy}px)`
        requestAnimationFrame(() => {
          node.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)'
          node.style.transform = 'translate(0, 0)'
        })
      }

      const swapBoardCardsInDom = (dragId, targetId) => {
        if (!dragId || !targetId || dragId === targetId) return false
        const dragCard = findBoardCardBySubId(dragId)
        const targetCard = findBoardCardBySubId(targetId)
        if (!(dragCard instanceof HTMLElement) || !(targetCard instanceof HTMLElement)) return false

        const dragBefore = dragCard.getBoundingClientRect()
        const targetBefore = targetCard.getBoundingClientRect()
        const swapped = swapSiblingNodes(dragCard, targetCard)
        if (!swapped) return false

        animateCardNodeMove(dragCard, dragBefore)
        animateCardNodeMove(targetCard, targetBefore)
        return true
      }

      const restoreSubscriptionOrderFromSnapshot = (snapshotIds = state.dragSubSnapshot) => {
        const snapshot = Array.isArray(snapshotIds) ? snapshotIds : null
        if (!snapshot || !snapshot.length) return false
        if (snapshot.length !== state.subscriptions.length) return false
        const map = new Map(state.subscriptions.map((s) => [s.id, s]))
        for (let i = 0; i < snapshot.length; i += 1) {
          if (!map.has(snapshot[i])) return false
        }
        state.subscriptions = snapshot.map((id) => map.get(id))
        return true
      }

      const startSubscriptionDrag = (id) => {
        state.dragSubId = id
        state.dragSubSnapshot = state.subscriptions.map((s) => s.id)
        state.dragSubDropped = false
        state.dragSubPreviewTargetId = null
        state.dragSubPreviewDirty = false
      }

      const assignSubscriptionCategory = async (subId, key) => {
        if (!subId || key === 'ALL') return
        const sub = state.subscriptions.find((s) => s.id === subId)
        if (!sub) return
        const nextCategoryId = key === 'UNCAT' ? '' : key
        if (sub.categoryId === nextCategoryId) return
        try {
          await runStoreTransaction(() => {
            sub.categoryId = nextCategoryId
          })
          renderAll()
        } catch {
          renderAll()
        }
      }

      const renderCategorySelect = () => {
        dom.fCategory.innerHTML = ''

        const base = document.createElement('option')
        base.value = ''
        base.textContent = 'Uncategorized'
        dom.fCategory.appendChild(base)

        const frag = document.createDocumentFragment()
        for (const c of state.categories) {
          const opt = document.createElement('option')
          opt.value = String(c.id || '')
          opt.textContent = String(c.name || '')
          frag.appendChild(opt)
        }
        dom.fCategory.appendChild(frag)
      }

      const filteredSubs = () => {
        const scoped = (() => {
          if (state.activeCategory === 'ALL') return state.subscriptions.slice()
          if (state.activeCategory === 'UNCAT') return state.subscriptions.filter((s) => !s.categoryId)
          return state.subscriptions.filter((s) => s.categoryId === state.activeCategory)
        })()

        const q = state.searchQuery.trim().toLowerCase()
        if (!q) return scoped
        return scoped.filter((s) => {
          const name = String(s.name || '').toLowerCase()
          const domain = parseDomain(s.url).toLowerCase()
          const cat = categoryNameById(s.categoryId).toLowerCase()
          return name.includes(q) || domain.includes(q) || cat.includes(q)
        })
      }

      const renderCategories = () => {
        dom.categoryList.innerHTML = ''
        dom.editCategoriesBtn.textContent = state.isCategoryEditMode ? 'Done' : 'Edit'
        dom.editCategoriesBtn.classList.toggle('active', state.isCategoryEditMode)
        dom.editCategoriesBtn.setAttribute('aria-pressed', state.isCategoryEditMode ? 'true' : 'false')
        const shouldAnimateCategoryEnter = !state.categoryListHasBootAnimated
        dom.categoryList.dataset.animateEnter = shouldAnimateCategoryEnter ? 'true' : 'false'

        const makeItem = ({ key, label, deletable, index }) => {
          const item = document.createElement('div')
          item.className = 'cat-item'
          item.style.setProperty('--cat-enter-index', String(index))
          const isRenaming = state.isCategoryEditMode && deletable && state.renamingCategoryId === key

          const pill = document.createElement('div')
          pill.className = `cat-pill${state.activeCategory === key ? ' active' : ''}`
          pill.dataset.catKey = key
          pill.draggable = state.isCategoryEditMode && deletable && !isRenaming

          const select = document.createElement(isRenaming ? 'div' : 'button')
          select.className = `cat-select${isRenaming ? ' editing' : ''}`
          if (!isRenaming) {
            select.type = 'button'
            select.draggable = false
            select.innerHTML = `<span class="cat-pill-label">${esc(label)}</span>`
            select.addEventListener('click', () => {
              if (state.isCategoryEditMode && deletable) {
                openCategoryRename(key)
                return
              }
              state.activeCategory = key
              state.pendingCategoryPulseKey = key
              clearCategoryRenameState()
              clearPendingDeleteState()
              renderAll()
            })
          } else {
            const input = document.createElement('input')
            input.className = 'cat-edit-input'
            input.dataset.categoryId = key
            input.maxLength = 30
            input.value = state.renamingCategoryDraft
            input.placeholder = 'Category name'
            input.addEventListener('input', () => {
              state.renamingCategoryDraft = input.value
              clearFieldInlineError(input)
            })
            input.addEventListener('keydown', async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                await saveCategoryRename(key)
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelCategoryRename()
              }
            })
            select.appendChild(input)
          }
          pill.appendChild(select)

          const canAcceptSubDrop = key !== 'ALL'
          const canAcceptCategoryDrop = state.isCategoryEditMode && deletable && !isRenaming

          pill.addEventListener('dragover', (e) => {
            if (!(e.dataTransfer instanceof DataTransfer)) return
            let handled = false

            if (canAcceptSubDrop && hasDndType(e.dataTransfer, DND_SUB)) {
              e.preventDefault()
              pill.classList.add('drop-target')
              handled = true
            }

            if (canAcceptCategoryDrop && hasDndType(e.dataTransfer, DND_CATEGORY) && state.dragCategoryId && state.dragCategoryId !== key) {
              e.preventDefault()
              const rect = item.getBoundingClientRect()
              const place = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
              item.classList.toggle('drop-before', place === 'before')
              item.classList.toggle('drop-after', place === 'after')
              handled = true
            }

            if (!handled) {
              pill.classList.remove('drop-target')
              item.classList.remove('drop-before', 'drop-after')
            }
          })

          pill.addEventListener('dragleave', (e) => {
            const related = e.relatedTarget
            if (related instanceof Node && item.contains(related)) return
            pill.classList.remove('drop-target')
            item.classList.remove('drop-before', 'drop-after')
          })

          pill.addEventListener('drop', async (e) => {
            if (!(e.dataTransfer instanceof DataTransfer)) return
            let handled = false

            if (canAcceptSubDrop && hasDndType(e.dataTransfer, DND_SUB)) {
              e.preventDefault()
              const subId = state.dragSubId || e.dataTransfer.getData(DND_SUB)
              if (state.dragSubPreviewDirty) restoreSubscriptionOrderFromSnapshot()
              state.dragSubDropped = true
              await assignSubscriptionCategory(subId, key)
              handled = true
            } else if (canAcceptCategoryDrop && hasDndType(e.dataTransfer, DND_CATEGORY)) {
              e.preventDefault()
              const dragId = state.dragCategoryId || e.dataTransfer.getData(DND_CATEGORY)
              const place = item.classList.contains('drop-after') ? 'after' : 'before'
              await moveCategoryByDrop(dragId, key, place)
              handled = true
            }

            if (handled) {
              clearDragState()
              clearCategoryDropStyles()
              clearBoardDropStyles()
              renderAll()
            }
          })

          const actions = document.createElement('div')
          actions.className = 'cat-actions placeholder'

          if (state.isCategoryEditMode && deletable) {
            actions.classList.remove('placeholder')
            if (state.pendingDeleteCategoryId === key) {
              const confirm = document.createElement('button')
              confirm.className = 'cat-mini confirm'
              confirm.type = 'button'
              confirm.textContent = '✓'
              confirm.title = 'Confirm delete'
              confirm.addEventListener('click', async (e) => {
                e.stopPropagation()
                await removeCategory(key)
              })
              actions.appendChild(confirm)

              const cancel = document.createElement('button')
              cancel.className = 'cat-mini'
              cancel.type = 'button'
              cancel.textContent = '✕'
              cancel.title = 'Cancel delete'
              cancel.addEventListener('click', (e) => {
                e.stopPropagation()
                clearPendingDeleteState()
                renderCategories()
              })
              actions.appendChild(cancel)
            } else {
              const del = document.createElement('button')
              del.className = 'cat-mini danger'
              del.type = 'button'
              del.title = 'Delete'
              del.innerHTML = "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 12h12'></path></svg>"
              del.addEventListener('click', (e) => {
                e.stopPropagation()
                clearCategoryRenameState()
                state.pendingDeleteCategoryId = key
                renderCategories()
              })
              actions.appendChild(del)
            }
          }

          pill.appendChild(actions)
          item.appendChild(pill)

          if (state.isCategoryEditMode && deletable && !isRenaming) {
            pill.addEventListener('dragstart', (e) => {
              if (!(e.dataTransfer instanceof DataTransfer)) return
              const target = e.target
              if (target instanceof Element && target.closest('.cat-mini')) {
                e.preventDefault()
                return
              }
              state.dragCategoryId = key
              e.dataTransfer.setData(DND_CATEGORY, key)
              e.dataTransfer.effectAllowed = 'move'
              requestAnimationFrame(() => {
                item.classList.add('dragging')
              })
            })
            pill.addEventListener('dragend', () => {
              clearDragState()
              clearCategoryDropStyles()
            })
          }

          return item
        }

        let catIndex = 0
        dom.categoryList.appendChild(makeItem({ key: 'ALL', label: 'All', deletable: false, index: catIndex++ }))
        dom.categoryList.appendChild(makeItem({ key: 'UNCAT', label: 'Uncategorized', deletable: false, index: catIndex++ }))
        const ordered = state.categories.slice()
        for (let i = 0; i < ordered.length; i += 1) {
          const c = ordered[i]
          dom.categoryList.appendChild(makeItem({ key: c.id, label: c.name, deletable: true, index: catIndex++ }))
        }

        if (state.pendingCategoryPulseKey) {
          const activePills = dom.categoryList.querySelectorAll('.cat-pill.active')
          for (const node of activePills) {
            if (!(node instanceof HTMLElement)) continue
            if (node.dataset.catKey !== state.pendingCategoryPulseKey) continue
            node.classList.remove('active-pulse')
            void node.offsetWidth
            node.classList.add('active-pulse')
            node.addEventListener('animationend', () => {
              node.classList.remove('active-pulse')
            }, { once: true })
            break
          }
          state.pendingCategoryPulseKey = ''
        }

        state.categoryListHasBootAnimated = true
      }

      const renderCard = (s, cardIndex = 0) => {
        const domain = parseDomain(s.url)
        const customIcon = sanitizeIconDataUrl(s.iconDataUrl)
        const p = progress(s)
        const cardStatus = resolveCardStatus(s, p)
        const categoryLabel = categoryNameById(s.categoryId)
        const priceValue = normalizePrice(s.price)
        const { startDate, endDate } = resolveDateRange(s)
        const renewalSummary = summarizeRenewalHistory(s.renewalHistory)
        const lastRenewal = renewalSummary.lastEntry
        const priceLabel = formatMoneyLabel(priceValue, s.currency)
        const totalSpentLabel = renewalSummary.hasHistory
          ? formatMoneyLabel(renewalSummary.totalSpent, lastRenewal?.currency || s.currency)
          : ''
        const lastRenewalLabel = lastRenewal ? formatMoneyLabel(lastRenewal.amount, lastRenewal.currency) : ''
        const lastRenewalMeta = lastRenewal ? `${lastRenewalLabel} · ${lastRenewal.paidAt}` : 'No renewals yet'
        const leftDays = Number.isFinite(p.leftDays) ? p.leftDays : null
        const shortEndDateLabel = endDate ? endDate.slice(5).replace('-', '/') : '--'
        const leftValue = !p.scheduled
          ? '--'
          : cardStatus === 'cancelled'
            ? shortEndDateLabel
            : String(Math.max(0, leftDays ?? 0))
        const leftUnit = cardStatus === 'active' || cardStatus === 'expired' ? 'd' : ''
        const progressSummaryLabel = !p.scheduled
          ? 'Dates not set'
          : cardStatus === 'cancelled'
            ? 'Cancelled'
            : cardStatus === 'expired'
              ? 'Expired'
              : `${p.pct}% used`
        const progressTone = cardStatus === 'cancelled'
          ? 'progress-cancelled'
          : (!p.scheduled || cardStatus === 'expired' ? 'progress-expired' : 'progress-active')
        const progressPct = cardStatus === 'active' ? p.pct : 100
        const cachedFavicon = domain ? getCachedFavicon(domain) : undefined
        const iconMarkup = customIcon
          ? `<img src="${esc(customIcon)}" alt="${esc(s.name)} icon" data-custom-icon="true">`
          : (domain
            ? (cachedFavicon === null
              ? defaultIconMarkup()
              : (typeof cachedFavicon === 'string'
                ? `<img src="${esc(cachedFavicon)}" data-cached-favicon="true" data-domain="${esc(domain)}" alt="${esc(s.name)} icon">`
                : `<img data-srcs='${esc(JSON.stringify(faviconSources(domain, s.url)))}' data-domain="${esc(domain)}" alt="${esc(s.name)} icon">`))
            : defaultIconMarkup())
        const card = document.createElement('article')
        card.className = 'card'
        card.draggable = true
        card.dataset.subId = s.id
        card.style.setProperty('--enter-index', String(cardIndex))
        card.innerHTML = `
          <div class="card-head">
            <div class="icon">${iconMarkup}</div>
            <div>
              <p class="name">${esc(s.name)}</p>
              <div class="card-submeta"><span class="category-badge">${esc(categoryLabel)}</span></div>
            </div>
            <span class="chip ${esc(cardStatus)}">${esc(cardStatus)}</span>
          </div>

          <div class="card-metrics card-secondary ${renewalSummary.hasHistory ? '' : 'card-metrics--single'}">
            <div class="stat-pill" title="Renewal price">
              <span class="stat-icon">${CARD_ICON.renewalPrice}</span>
              <div class="stat-copy">
                <b class="${priceValue === null ? 'is-empty' : ''}">${esc(priceLabel)}</b>
                <small>Renewal</small>
              </div>
            </div>
            ${renewalSummary.hasHistory ? `
              <div class="stat-pill" title="Total spent">
                <span class="stat-icon">${CARD_ICON.totalSpent}</span>
                <div class="stat-copy">
                  <b>${esc(totalSpentLabel)}</b>
                  <small>Total spent</small>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="card-meta card-secondary ${renewalSummary.hasHistory ? '' : 'is-empty'}" title="Last renewal">
            <span class="meta-icon">${CARD_ICON.lastPaid}</span>
            <span class="meta-text ${lastRenewal ? '' : 'is-empty'}">${esc(lastRenewalMeta)}</span>
          </div>
          <div class="timeline-panel card-secondary ${esc(progressTone)}">
            <div class="timeline-headline">
              <div class="timeline-figure ${p.scheduled ? '' : 'is-empty'}">
                <span class="timeline-figure__icon">${CARD_ICON.daysLeft}</span>
                <div class="timeline-figure__copy">
                  <div class="timeline-figure__value ${cardStatus === 'cancelled' ? 'is-date' : ''}">
                    <b>${esc(leftValue)}</b>
                    ${leftUnit ? `<span class="timeline-figure__unit">${esc(leftUnit)}</span>` : ''}
                  </div>
                </div>
              </div>
              <span class="timeline-status ${esc(progressTone)}">${esc(progressSummaryLabel)}</span>
            </div>
            <div class="progress progress-hero ${esc(progressTone)}"><span style="width:${progressPct}%"></span></div>
            <div class="timeline-window ${startDate && endDate ? '' : 'is-empty'}">
              <span class="timeline-date">
                <span class="timeline-date__icon">${CARD_ICON.startDate}</span>
                <span class="timeline-date__text">${esc(startDate || '--')}</span>
              </span>
              <span class="timeline-date">
                <span class="timeline-date__icon">${CARD_ICON.endDate}</span>
                <span class="timeline-date__text">${esc(endDate || '--')}</span>
              </span>
            </div>
          </div>
        `

        const customImg = card.querySelector('img[data-custom-icon="true"]')
        if (customImg) {
          customImg.addEventListener('error', () => {
            const fb = document.createElement('span')
            fb.className = 'default-icon'
            fb.innerHTML = DEFAULT_ICON_SVG
            customImg.replaceWith(fb)
          })
        }

        const cachedImg = card.querySelector('img[data-cached-favicon="true"]')
        if (cachedImg) {
          cachedImg.addEventListener('error', () => {
            const cacheDomain = String(cachedImg.dataset.domain || '')
            if (cacheDomain) setCachedFavicon(cacheDomain, null)
            const fb = document.createElement('span')
            fb.className = 'default-icon'
            fb.innerHTML = DEFAULT_ICON_SVG
            cachedImg.replaceWith(fb)
          })
        }

        const img = card.querySelector('img[data-srcs]')
        if (img) {
          const cacheDomain = String(img.dataset.domain || '')
          const srcs = JSON.parse(img.dataset.srcs || '[]')
          let i = 0
          const fallback = () => {
            if (cacheDomain) setCachedFavicon(cacheDomain, null)
            const fb = document.createElement('span')
            fb.className = 'default-icon'
            fb.innerHTML = DEFAULT_ICON_SVG
            img.replaceWith(fb)
          }
          const next = () => {
            if (i >= srcs.length) return fallback()
            img.src = srcs[i++]
          }
          img.addEventListener('load', () => {
            const resolved = String(img.currentSrc || img.src || '')
            if (cacheDomain && resolved) setCachedFavicon(cacheDomain, resolved)
          }, { once: true })
          img.addEventListener('error', next)
          next()
        }

        card.addEventListener('click', (e) => {
          if (state.dragSubId) return
          void openEditor(s, { fromCard: true })
        })

        card.addEventListener('dragstart', (e) => {
          if (!(e.dataTransfer instanceof DataTransfer)) return
          startSubscriptionDrag(s.id)
          e.dataTransfer.setData(DND_SUB, s.id)
          e.dataTransfer.effectAllowed = 'move'
          requestAnimationFrame(() => {
            card.classList.add('dragging')
          })
        })

        card.addEventListener('dragend', () => {
          if (!state.dragSubDropped && state.dragSubPreviewDirty && restoreSubscriptionOrderFromSnapshot()) {
            renderBoard()
          }
          clearDragState()
          clearBoardDropStyles()
          clearCategoryDropStyles()
        })

        card.addEventListener('dragover', (e) => {
          if (!(e.dataTransfer instanceof DataTransfer) || !hasDndType(e.dataTransfer, DND_SUB)) return
          if (!state.dragSubId || state.dragSubId === s.id) return
          e.preventDefault()
          if (state.dragSubPreviewTargetId === s.id) return
          const moved = swapSubscriptionInMemory(state.dragSubId, s.id)
          state.dragSubPreviewTargetId = s.id
          if (!moved) return
          state.dragSubPreviewDirty = true
          if (!swapBoardCardsInDom(state.dragSubId, s.id)) {
            renderBoard()
          }
        })

        card.addEventListener('dragleave', (e) => {
          const related = e.relatedTarget
          if (related instanceof Node && card.contains(related)) return
          card.classList.remove('drop-before', 'drop-after')
        })

        card.addEventListener('drop', async (e) => {
          if (!(e.dataTransfer instanceof DataTransfer) || !hasDndType(e.dataTransfer, DND_SUB)) return
          e.preventDefault()
          const rollbackSnapshot = Array.isArray(state.dragSubSnapshot) ? state.dragSubSnapshot.slice() : null
          let rollback = false
          const dragId = state.dragSubId || e.dataTransfer.getData(DND_SUB)
          if (state.dragSubPreviewTargetId !== s.id) {
            const moved = swapSubscriptionInMemory(dragId, s.id)
            if (moved) state.dragSubPreviewDirty = true
          }
          state.dragSubDropped = true
          try {
            await persistDragPreviewOrRollback(rollbackSnapshot)
          } catch {
            rollback = true
            showGlobalNotice('Failed to save drag order. Changes were reverted.')
          }
          clearDragState()
          clearBoardDropStyles()
          clearCategoryDropStyles()
          if (rollback) renderBoard()
        })

        return card
      }

      const renderEmptyState = () => {
        const hasSearch = Boolean(state.searchQuery.trim())
        const title = hasSearch ? 'No results' : 'No subscriptions'
        const text = hasSearch
          ? 'Try another keyword.'
          : (state.activeCategory === 'ALL'
            ? 'Use New to add one.'
            : 'This category is empty.')
        return `
          <div class="empty">
            <div class="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 8h16"></path><path d="M4 12h16"></path><path d="M4 16h10"></path></svg>
            </div>
            <p class="empty-title">${esc(title)}</p>
            <p class="empty-text">${esc(text)}</p>
          </div>
        `
      }

      const captureBoardCardRects = () => {
        const rects = new Map()
        dom.board.querySelectorAll('.card[data-sub-id]').forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          const { subId } = node.dataset
          if (!subId) return
          rects.set(subId, node.getBoundingClientRect())
        })
        return rects
      }

      const animateBoardCardReflow = (rects) => {
        if (!(rects instanceof Map) || rects.size === 0) return
        dom.board.querySelectorAll('.card[data-sub-id]').forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          const { subId } = node.dataset
          if (!subId) return
          const prev = rects.get(subId)
          if (!prev) return
          const next = node.getBoundingClientRect()
          const dx = prev.left - next.left
          const dy = prev.top - next.top
          if (!dx && !dy) return

          node.style.transition = 'none'
          node.style.transform = `translate(${dx}px, ${dy}px)`

          requestAnimationFrame(() => {
            node.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)'
            node.style.transform = 'translate(0, 0)'
          })
        })
      }

      const renderBoard = () => {
        const shouldAnimateReflow = Boolean(state.dragSubId)
        const prevRects = shouldAnimateReflow ? captureBoardCardRects() : null
        const shouldAnimateEnter = !shouldAnimateReflow && !state.boardHasBootAnimated
        const list = filteredSubs()
        dom.board.dataset.animateEnter = shouldAnimateEnter ? 'true' : 'false'
        dom.board.classList.toggle('is-empty', !list.length)
        dom.board.innerHTML = ''

        if (!list.length) {
          dom.board.innerHTML = renderEmptyState()
          state.boardHasBootAnimated = true
          return
        }

        list.forEach((s, idx) => {
          dom.board.appendChild(renderCard(s, idx))
        })
        if (prevRects) animateBoardCardReflow(prevRects)
        state.boardHasBootAnimated = true
      }

      const bindBoardResizeObserver = () => {
        if (dom.board.dataset.boundResize === 'true' || typeof ResizeObserver !== 'function') return
        dom.board.dataset.boundResize = 'true'
        let lastWidth = Math.round(dom.board.getBoundingClientRect().width)
        const observer = new ResizeObserver((entries) => {
          const width = Math.round(entries[0]?.contentRect?.width || 0)
          if (!width || width === lastWidth) return
          lastWidth = width
          window.clearTimeout(boardResizeTimer)
          dom.board.dataset.resizing = 'true'
          boardResizeTimer = window.setTimeout(() => {
            dom.board.dataset.resizing = 'false'
            if (!state.dragSubId) {
              renderBoard()
            }
          }, 140)
        })
        observer.observe(dom.board)
      }

      const renderAll = () => {
        renderCategorySelect()
        renderCategories()
        renderBoard()
      }

      const resetEditor = () => {
        state.editingId = null
        state.editorIconDataUrl = ''
        state.pendingRenewalDeleteId = null
        dom.editorTitle.textContent = 'New Subscription'
        syncEditorUtilityActions(null)
        setFormError(dom.editorError, '')
        clearEditorInlineErrors()
        setButtonPending(dom.editorSaveBtn, 'Saving...', false)
        setButtonPending(dom.deleteSubBtn, 'Deleting...', false)
        resetDeleteButtonState()
        dom.deleteSubBtn.hidden = true
        dom.cancelBtn.disabled = false
        dom.editorForm.reset()
        dom.fCurrency.value = 'CNY'
        dom.fStatus.value = 'active'
        dom.fStartDate.value = ''
        dom.fEndDate.value = ''
        dom.fCategory.value = ''
        dom.fIconUpload.value = ''
        renderEditorRenewalHistory('')
        renderEditorIconPreview()
      }

      const openEditor = async (s, { fromCard = false } = {}) => {
        if (state.editorTransitionBusy) return
        state.editorTransitionBusy = true
        try {
          resetEditor()
          state.editorOriginSubId = fromCard && s?.id ? s.id : ''
          if (s) {
            state.editingId = s.id
            dom.editorTitle.textContent = 'Edit Subscription'
            syncEditorUtilityActions(s)
            resetDeleteButtonState()
            dom.deleteSubBtn.hidden = false
            dom.fName.value = s.name || ''
            dom.fUrl.value = s.url || ''
            dom.fPrice.value = String(s.price ?? '')
            dom.fCurrency.value = normalizeCurrency(s.currency)
            dom.fCategory.value = s.categoryId || ''
            dom.fStatus.value = s.status === 'cancelled' ? 'cancelled' : 'active'
            const { startDate, endDate } = resolveDateRange(s)
            dom.fStartDate.value = startDate
            dom.fEndDate.value = endDate
            dom.fNote.value = s.note || ''
            state.editorIconDataUrl = sanitizeIconDataUrl(s.iconDataUrl)
            renderEditorRenewalHistory(s.id)
          }
          renderEditorIconPreview()
          dom.editor.showModal()
          await animateEditorDialogTransition('in')
        } finally {
          state.editorTransitionBusy = false
          const pending = state.pendingEditorCloseJob
          state.pendingEditorCloseJob = null
          if (pending) {
            void closeEditorWithCardReturn(pending.subId, {
              rerenderBoard: pending.rerenderBoard,
              refreshCard: pending.refreshCard,
            })
          }
        }
      }

      const collectForm = () => {
        const name = dom.fName.value.trim()
        const urlRaw = String(dom.fUrl.value || '').trim()
        const url = urlRaw ? normalizeUrl(urlRaw) : ''
        const priceRaw = dom.fPrice.value.trim()
        const price = normalizePrice(priceRaw)
        const currency = normalizeCurrency(dom.fCurrency.value)
        const categoryId = dom.fCategory.value || ''
        const status = dom.fStatus.value === 'cancelled' ? 'cancelled' : 'active'
        const startDate = normalizeIsoDate(dom.fStartDate.value, '')
        const endDate = normalizeIsoDate(dom.fEndDate.value, '')
        const note = dom.fNote.value.trim().slice(0, 300)

        if (!name) throw createEditorValidationError('name', 'Name is required')
        if (startDate && !endDate) throw createEditorValidationError('endDate', 'End date is required')
        if (endDate && !startDate) throw createEditorValidationError('startDate', 'Start date is required')
        if (startDate && endDate && startDate > endDate) {
          throw createEditorValidationError('endDate', 'End date must be after start date')
        }

        return { name, url, price, currency, categoryId, status, startDate, endDate, iconDataUrl: sanitizeIconDataUrl(state.editorIconDataUrl), note }
      }

      const bindRenewalEvents = () => {
        if (dom.renewalSaveBtn.dataset.boundRenewal === 'true') return
        dom.renewalSaveBtn.dataset.boundRenewal = 'true'

        dom.cancelRenewalBtn.addEventListener('click', () => {
          closeRenewalEditor()
        })
        dom.renewalEditor.addEventListener('cancel', (e) => {
          e.preventDefault()
          closeRenewalEditor()
        })
        dom.renewalSaveBtn.addEventListener('click', () => {
          void submitRenewalSave()
        })
        dom.renewalEditorForm.addEventListener('submit', async (e) => {
          e.preventDefault()
          await submitRenewalSave()
        })
        dom.editorOpenUrlBtn.addEventListener('click', async () => {
          const subscription = state.subscriptions.find((item) => item.id === state.editingId)
          if (!subscription) return
          await openSubscriptionUrl(subscription.url)
        })
        dom.editorRenewBtn.addEventListener('click', async () => {
          const subscription = state.subscriptions.find((item) => item.id === state.editingId)
          if (!subscription) return
          openRenewalEditor(subscription)
        })
      }

      const normalizeLoaded = () => {
        state.categories = state.categories
          .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
          .map((c) => ({ id: c.id, name: normalizeCategoryName(c.name) }))
          .filter((c) => c.name)

        state.subscriptions = state.subscriptions
          .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
          .map((s) => {
            let categoryId = typeof s.categoryId === 'string' ? s.categoryId : ''
            if (!categoryId && typeof s.category === 'string' && s.category.trim()) categoryId = ensureCategoryByName(s.category)
            if (categoryId && !state.categories.some((c) => c.id === categoryId)) categoryId = ''
            return {
              id: s.id,
              name: String(s.name || '').trim().slice(0, 80),
              url: normalizeUrl(s.url || ''),
              price: normalizePrice(s.price),
              currency: normalizeCurrency(s.currency),
              categoryId,
              status: s.status === 'cancelled' ? 'cancelled' : 'active',
              startDate: resolveDateRange(s).startDate,
              endDate: resolveDateRange(s).endDate,
              iconDataUrl: sanitizeIconDataUrl(s.iconDataUrl),
              note: String(s.note || '').slice(0, 300),
              renewalHistory: summarizeRenewalHistory(s.renewalHistory).entries,
            }
          })
      }

      const needsStoreMigration = (dataStore) => {
        if (!dataStore || typeof dataStore !== 'object') return false
        if (Number(dataStore.schemaVersion) < 4) return true
        return state.subscriptions.some((subscription) => {
          if (!subscription || typeof subscription !== 'object') return false
          return (
            'billingCycle' in subscription
            || 'customDays' in subscription
            || 'nextBillingDate' in subscription
            || !('startDate' in subscription)
            || !('endDate' in subscription)
            || !Array.isArray(subscription.renewalHistory)
          )
        })
      }

      const createTrackerEventsApi = window.createLeeOSSubscriptionTrackerEventsAPI
      if (!createTrackerEventsApi) {
        throw new Error('Subscription Tracker events module is not loaded')
      }
      const { bindEvents } = createTrackerEventsApi({
        dom,
        state,
        DND_SUB,
        hasDndType,
        bindOpenDataDirButton,
        setFormError,
        normalizeCategoryName,
        setButtonPending,
        runStoreTransaction,
        uid,
        clearCategoryRenameState,
        clearPendingDeleteState,
        renderAll,
        resetDeleteButtonState,
        clearEditorInlineErrors,
        collectForm,
        applyEditorInlineError,
        closeEditorWithCardReturn,
        openEditor,
        toggleCategoryEditMode,
        persistDragPreviewOrRollback,
        showGlobalNotice,
        clearDragState,
        clearBoardDropStyles,
        clearCategoryDropStyles,
        renderBoard,
        clearFieldInlineError,
        sanitizeIconDataUrl,
        renderEditorIconPreview,
        isAllowedIconFile,
        MAX_ICON_SIZE_BYTES,
        fileToDataUrl,
      })
      const boot = async () => {
        const fsApi = window.LeeOS?.fs
        const canRead = Boolean(fsApi?.readText || fsApi?.readJson)
        const canWrite = Boolean(fsApi?.writeText || fsApi?.writeJson)
        if (!canRead || !canWrite) {
          dom.board.innerHTML = '<div class="empty">Host does not support plugin storage APIs.</div>'
          return
        }

        bindOpenDataDirButton()
        await syncOpenDataDirButton()

        const bootSnapshot = captureStoreSnapshot()
        let shouldPersistAfterNormalize = false
        const dataStore = await readDataStore()
        if (dataStore.status === 'ok' && dataStore.data) {
          state.subscriptions = dataStore.data.subscriptions
          state.categories = dataStore.data.categories
          shouldPersistAfterNormalize = needsStoreMigration(dataStore.data)
        } else if (dataStore.status === 'missing') {
          const [legacySubs, legacyCats] = await Promise.all([
            readLegacyJsonArray(FILE_SUBS_LEGACY),
            readLegacyJsonArray(FILE_CATS_LEGACY),
          ])
          const invalidLegacy = [legacySubs, legacyCats].find((entry) => entry.status === 'invalid')
          if (invalidLegacy) {
            const reason = invalidLegacy.message || 'Legacy migration was blocked because a source file is invalid.'
            dom.board.classList.add('is-empty')
            dom.board.innerHTML = `
              <div class="empty">
                <div class="empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 8v5"></path><path d="M12 16h.01"></path><path d="M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z"></path></svg>
                </div>
                <p class="empty-title">Legacy data is invalid</p>
                <p class="empty-text">${esc(reason)}</p>
              </div>
            `
            return
          }

          const subs = legacySubs.status === 'ok' ? legacySubs.data : []
          const cats = legacyCats.status === 'ok' ? legacyCats.data : []
          if (!subs.length && !cats.length) {
            state.subscriptions = []
            state.categories = []
          } else {
            state.subscriptions = subs
            state.categories = cats
          }
          shouldPersistAfterNormalize = true
        } else {
          const reason = dataStore.message || `${FILE_DATA} is invalid.`
          dom.board.classList.add('is-empty')
          dom.board.innerHTML = `
            <div class="empty">
              <div class="empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 8v5"></path><path d="M12 16h.01"></path><path d="M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z"></path></svg>
              </div>
              <p class="empty-title">Data file is invalid</p>
              <p class="empty-text">${esc(reason)}</p>
            </div>
          `
          return
        }
        normalizeLoaded()
        if (shouldPersistAfterNormalize) {
          try {
            await saveAll()
          } catch (err) {
            restoreStoreSnapshot(bootSnapshot)
            throw err
          }
          await writeStorageReadme()
          if (dataStore.status === 'missing') {
            await cleanupLegacyStorageFiles()
          }
        }

        bindEvents()
        bindRenewalEvents()
        bindBoardResizeObserver()
        resetEditor()
        renderAll()
      }

      boot().catch(() => {
        dom.board.innerHTML = '<div class="empty">Plugin failed to initialize.</div>'
      })

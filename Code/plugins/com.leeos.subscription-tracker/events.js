;(() => {
  const createLeeOSSubscriptionTrackerEventsAPI = ({
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
  }) => {
      const bindEvents = () => {
        bindOpenDataDirButton()

        const submitCategoryCreate = async () => {
          setFormError(dom.categoryCreatorError, '')
          const name = normalizeCategoryName(dom.fNewCategoryName.value)
          if (!name) {
            setFormError(dom.categoryCreatorError, 'Category name is required.')
            return
          }
          const exists = state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())
          if (exists) {
            setFormError(dom.categoryCreatorError, 'Category already exists.')
            return
          }
          setButtonPending(dom.createCategoryBtn, 'Creating...', true)
          try {
            const id = uid('cat')
            await runStoreTransaction(() => {
              state.categories.push({ id, name })
              state.activeCategory = id
            })
            state.pendingCategoryPulseKey = id
            clearCategoryRenameState()
            clearPendingDeleteState()
            dom.fNewCategoryName.value = ''
            dom.categoryCreator.close()
            renderAll()
          } catch (err) {
            setFormError(dom.categoryCreatorError, err instanceof Error ? err.message : 'Create category failed.')
          } finally {
            setButtonPending(dom.createCategoryBtn, 'Creating...', false)
          }
        }

        const submitEditorSave = async () => {
          setFormError(dom.editorError, '')
          resetDeleteButtonState()
          clearEditorInlineErrors()
          const editingId = state.editingId
          const isEditing = Boolean(editingId)
          let payload
          try {
            payload = collectForm()
          } catch (err) {
            const field = err && typeof err === 'object' ? err.field : ''
            const message = err instanceof Error ? err.message : 'Save failed.'
            if (!applyEditorInlineError(field, message)) {
              setFormError(dom.editorError, message)
            }
            return
          }
          setButtonPending(dom.editorSaveBtn, 'Saving...', true)
          try {
            await runStoreTransaction(() => {
              if (editingId) {
                const target = state.subscriptions.find((x) => x.id === editingId)
                if (!target) throw new Error('Subscription not found. Reopen and try again.')
                Object.assign(target, payload)
              } else {
                state.subscriptions.unshift({ id: uid('sub'), ...payload })
              }
            })
            if (isEditing && editingId) {
              await closeEditorWithCardReturn(editingId, { rerenderBoard: true, refreshCard: true })
            } else {
              await closeEditorWithCardReturn('', { rerenderBoard: true, refreshCard: false })
            }
          } catch (err) {
            setFormError(dom.editorError, err instanceof Error ? err.message : 'Save failed.')
          } finally {
            setButtonPending(dom.editorSaveBtn, 'Saving...', false)
          }
        }

        const submitEditorDelete = async () => {
          setFormError(dom.editorError, '')
          const targetId = state.editingId
          if (!targetId) return
          const target = state.subscriptions.find((x) => x.id === targetId)
          if (!target) {
            setFormError(dom.editorError, 'Subscription not found. Reopen and try again.')
            return
          }

          if (!state.editorDeleteArmed) {
            state.editorDeleteArmed = true
            dom.deleteSubBtn.textContent = 'Confirm'
            dom.deleteSubBtn.dataset.baseLabel = 'Confirm'
            return
          }

          setButtonPending(dom.deleteSubBtn, 'Deleting...', true)
          dom.editorSaveBtn.disabled = true
          dom.cancelBtn.disabled = true
          try {
            await runStoreTransaction(() => {
              state.subscriptions = state.subscriptions.filter((x) => x.id !== targetId)
            })
            await closeEditorWithCardReturn(targetId, { rerenderBoard: true, refreshCard: false })
          } catch (err) {
            setFormError(dom.editorError, err instanceof Error ? err.message : 'Delete failed.')
          } finally {
            setButtonPending(dom.deleteSubBtn, 'Deleting...', false)
            resetDeleteButtonState()
            dom.editorSaveBtn.disabled = false
            dom.cancelBtn.disabled = false
          }
        }

        dom.newSubBtn.addEventListener('click', () => {
          void openEditor(null)
        })
        dom.cancelBtn.addEventListener('click', () => {
          void closeEditorWithCardReturn(state.editorOriginSubId)
        })
        dom.editor.addEventListener('cancel', (e) => {
          e.preventDefault()
          void closeEditorWithCardReturn(state.editorOriginSubId)
        })
        dom.editCategoriesBtn.addEventListener('click', () => {
          toggleCategoryEditMode()
        })
        dom.openAddCategoryBtn.addEventListener('click', () => {
          dom.fNewCategoryName.value = ''
          setFormError(dom.categoryCreatorError, '')
          setButtonPending(dom.createCategoryBtn, 'Creating...', false)
          dom.categoryCreator.showModal()
          requestAnimationFrame(() => {
            dom.fNewCategoryName.focus()
          })
        })
        dom.cancelCategoryBtn.addEventListener('click', () => {
          dom.categoryCreator.close()
        })

        dom.searchInput.addEventListener('input', () => {
          state.searchQuery = dom.searchInput.value || ''
          renderBoard()
        })

        dom.board.addEventListener('dragover', (e) => {
          if (!(e.dataTransfer instanceof DataTransfer) || !hasDndType(e.dataTransfer, DND_SUB)) return
          if (!state.dragSubId) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          const hovered = e.target instanceof Element ? e.target.closest('.card[data-sub-id]') : null
          const hoveredId = hovered instanceof HTMLElement ? (hovered.dataset.subId || '') : ''
          if (!hoveredId || hoveredId === state.dragSubId) {
            state.dragSubPreviewTargetId = null
          }
        })

        dom.board.addEventListener('drop', async (e) => {
          if (!(e.dataTransfer instanceof DataTransfer) || !hasDndType(e.dataTransfer, DND_SUB)) return
          const target = e.target
          if (target instanceof Element && target.closest('.card')) return
          e.preventDefault()
          if (!state.dragSubId) return
          const rollbackSnapshot = Array.isArray(state.dragSubSnapshot) ? state.dragSubSnapshot.slice() : null
          let rollback = false
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

        dom.fName.addEventListener('input', () => {
          setFormError(dom.editorError, '')
          clearFieldInlineError(dom.fName)
        })
        dom.fUrl.addEventListener('input', () => {
          setFormError(dom.editorError, '')
          clearFieldInlineError(dom.fUrl)
          if (!sanitizeIconDataUrl(state.editorIconDataUrl)) renderEditorIconPreview()
        })
        dom.fPrice.addEventListener('input', () => {
          setFormError(dom.editorError, '')
          clearFieldInlineError(dom.fPrice)
        })
        dom.fStartDate.addEventListener('input', () => {
          setFormError(dom.editorError, '')
          clearFieldInlineError(dom.fStartDate)
        })
        dom.fEndDate.addEventListener('input', () => {
          setFormError(dom.editorError, '')
          clearFieldInlineError(dom.fEndDate)
        })
        dom.fNewCategoryName.addEventListener('input', () => setFormError(dom.categoryCreatorError, ''))
        dom.chooseIconBtn.addEventListener('click', () => {
          dom.fIconUpload.click()
        })
        dom.clearIconBtn.addEventListener('click', () => {
          if (!sanitizeIconDataUrl(state.editorIconDataUrl)) return
          state.editorIconDataUrl = ''
          dom.fIconUpload.value = ''
          renderEditorIconPreview()
        })
        dom.fIconUpload.addEventListener('change', async () => {
          const file = dom.fIconUpload.files?.[0]
          if (!file) return
          setFormError(dom.editorError, '')
          if (!isAllowedIconFile(file)) {
            setFormError(dom.editorError, 'Only png/jpeg/webp/gif/ico files are supported.')
            dom.fIconUpload.value = ''
            return
          }
          if (file.size > MAX_ICON_SIZE_BYTES) {
            setFormError(dom.editorError, 'Icon file size must be 2MB or smaller.')
            dom.fIconUpload.value = ''
            return
          }
          try {
            const dataUrl = await fileToDataUrl(file)
            const clean = sanitizeIconDataUrl(dataUrl)
            if (!clean) throw new Error('Icon data is invalid.')
            state.editorIconDataUrl = clean
            renderEditorIconPreview()
          } catch (err) {
            setFormError(dom.editorError, err instanceof Error ? err.message : 'Failed to load icon file.')
          } finally {
            dom.fIconUpload.value = ''
          }
        })
        dom.createCategoryBtn.addEventListener('click', () => {
          void submitCategoryCreate()
        })
        dom.editorSaveBtn.addEventListener('click', () => {
          void submitEditorSave()
        })
        dom.deleteSubBtn.addEventListener('click', () => {
          void submitEditorDelete()
        })

        dom.categoryCreatorForm.addEventListener('submit', async (e) => {
          e.preventDefault()
          await submitCategoryCreate()
        })

        dom.editorForm.addEventListener('submit', async (e) => {
          e.preventDefault()
          await submitEditorSave()
        })
      }

    return { bindEvents }
  }

  window.createLeeOSSubscriptionTrackerEventsAPI = createLeeOSSubscriptionTrackerEventsAPI
})()

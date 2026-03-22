;(() => {
  const createLeeOSBodyMetricsEventsAPI = ({
    elements,
    state,
    CATEGORY_MAP,
    METRIC_MAP,
    renderAll,
    openMetric,
    hideChartTip,
    showChartTip,
    openDataDir,
    closeMetricModal,
    setFormError,
    handleCreateSubmit,
    applyLatestValueToInput,
    renderEntryList,
    saveEditedEntry,
    removeEntry,
  }) => {
      function attachEvents() {
        elements.categoryList.addEventListener("click", (event) => {
          if (!(event.target instanceof Element)) return;
          const target = event.target.closest(".cat-item");
          if (!target) return;
          const categoryId = target.dataset.categoryId;
          if (!CATEGORY_MAP.has(categoryId)) return;
          state.activeCategory = categoryId;
          elements.cards.scrollTop = 0;
          renderAll();
        });

        elements.cards.addEventListener("click", (event) => {
          if (!(event.target instanceof Element)) return;
          const card = event.target.closest(".metric-card");
          if (!card) return;
          const metricId = card.dataset.metricId;
          if (!metricId || !METRIC_MAP.has(metricId)) return;
          openMetric(metricId);
        });

        elements.chart.addEventListener("mousemove", (event) => {
          const point = event.target instanceof Element ? event.target.closest(".chart-point") : null;
          if (!point) {
            hideChartTip();
            return;
          }
          showChartTip(point, event.clientX, event.clientY);
        });
        elements.chart.addEventListener("mouseleave", () => {
          hideChartTip();
        });

        elements.dataDirBtn.addEventListener("click", () => {
          openDataDir();
        });

        elements.closeModal.addEventListener("click", () => closeMetricModal());
        elements.modalBackdrop.addEventListener("click", (event) => {
          if (event.target === elements.modalBackdrop) {
            closeMetricModal();
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && state.activeMetricId) {
            closeMetricModal();
          }
        });

        elements.entryForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          setFormError("");
          await handleCreateSubmit();
        });

        elements.saveEntryBtn.addEventListener("click", async () => {
          setFormError("");
          await handleCreateSubmit();
        });

        elements.pullLastBtn.addEventListener("click", () => {
          const metric = state.activeMetricId ? METRIC_MAP.get(state.activeMetricId) : null;
          if (!metric) return;
          applyLatestValueToInput(metric);
        });

        elements.entries.addEventListener("click", async (event) => {
          if (!state.activeMetricId) return;
          const metric = METRIC_MAP.get(state.activeMetricId);
          if (!metric || metric.autoComputed) return;

          if (!(event.target instanceof Element)) return;
          const button = event.target.closest("button");
          if (!button) return;
          const action = button.dataset.action;
          const entryId = button.dataset.entryId;
          if (!action) return;

          if (action === "edit") {
            state.editingEntryId = entryId;
            state.pendingDeleteId = null;
            setFormError("");
            renderEntryList(metric);
            return;
          }

          if (action === "cancel-edit") {
            state.editingEntryId = null;
            setFormError("");
            renderEntryList(metric);
            return;
          }

          if (action === "save-edit") {
            const row = button.closest(".entry-row");
            if (!row) return;
            const dateInput = row.querySelector('[data-role="edit-date"]');
            const valueInput = row.querySelector('[data-role="edit-value"]');
            if (!dateInput || !valueInput) return;
            await saveEditedEntry(metric, entryId, dateInput.value, valueInput.value);
            return;
          }

          if (action === "delete") {
            state.pendingDeleteId = entryId;
            state.editingEntryId = null;
            renderEntryList(metric);
            return;
          }

          if (action === "cancel-delete") {
            state.pendingDeleteId = null;
            renderEntryList(metric);
            return;
          }

          if (action === "confirm-delete") {
            await removeEntry(metric, entryId);
          }
        });
      }

    return { attachEvents }
  }

  window.createLeeOSBodyMetricsEventsAPI = createLeeOSBodyMetricsEventsAPI
})()

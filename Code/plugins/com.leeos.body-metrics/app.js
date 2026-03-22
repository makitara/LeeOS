      const bodyMetricsConstants = window.LeeOSBodyMetricsConstants
      if (!bodyMetricsConstants) {
        throw new Error('Body Metrics constants module is not loaded')
      }
      const { DATA_FILE, CATEGORIES, FIXED_METRICS, ICON_SVGS, UI_ICONS } = bodyMetricsConstants


      const METRIC_MAP = new Map(FIXED_METRICS.map((metric) => [metric.id, metric]));
      const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]));
      const BLOOD_BIOCHEM_IDS = new Set(["alt", "ast", "cr", "tc", "tg"]);
      const BLOOD_PLATELET_IDS = new Set(["plt", "mpv", "pdw", "pct"]);
      const BLOOD_DIFF_IDS = new Set([
        "lymph_pct", "neut_pct", "lymph", "neut", "mono_pct", "mono", "eos_pct", "eos", "baso_pct", "baso"
      ]);
      const URINE_TUBE_IDS = new Set(["sg", "ph"]);
      const URINE_MICROBE_IDS = new Set(["leu", "nit"]);
      const URINE_MOLECULE_IDS = new Set(["pro", "glu", "ket"]);
      const URINE_PIGMENT_IDS = new Set(["uro", "bil"]);
      const TODAY = new Date();
      const TODAY_STR = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;

      const state = {
        data: createInitialData(),
        activeCategory: "whole",
        activeMetricId: null,
        pendingDeleteId: null,
        editingEntryId: null,
        isBusy: false,
        isSubmitting: false,
        message: "",
        lastPersistError: "",
        openDirSupported: true
      };

      const elements = {
        categoryList: document.getElementById("categoryList"),
        dataDirBtn: document.getElementById("dataDirBtn"),
        categoryTitle: document.getElementById("categoryTitle"),
        cards: document.getElementById("cards"),
        notice: document.getElementById("notice"),
        modalBackdrop: document.getElementById("modalBackdrop"),
        closeModal: document.getElementById("closeModal"),
        modalTitle: document.getElementById("modalTitle"),
        rangeEditor: document.getElementById("rangeEditor"),
        chart: document.getElementById("chart"),
        chartTip: document.getElementById("chartTip"),
        chartEmpty: document.getElementById("chartEmpty"),
        entryForm: document.getElementById("entryForm"),
        entryDate: document.getElementById("entryDate"),
        entryValueField: document.getElementById("entryValueField"),
        pullLastBtn: document.getElementById("pullLastBtn"),
        saveEntryBtn: document.getElementById("saveEntryBtn"),
        formError: document.getElementById("formError"),
        entries: document.getElementById("entries")
      };


      function createInitialData() {
        return {
          version: 1,
          dominantEye: null,
          metrics: {},
          metricSettings: {}
        };
      }

      function cloneData(data) {
        return JSON.parse(JSON.stringify(data));
      }

      function makeId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }
        return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      function isFutureDate(dateText) {
        return isValidDateText(dateText) && dateText > TODAY_STR;
      }

      function isValidDateText(dateText) {
        const text = String(dateText || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          return false;
        }
        const [yearText, monthText, dayText] = text.split("-");
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
          return false;
        }
        const candidate = new Date(Date.UTC(year, month - 1, day));
        return candidate.getUTCFullYear() === year
          && candidate.getUTCMonth() === month - 1
          && candidate.getUTCDate() === day;
      }

      function normalizeStoredEntryValue(metric, rawValue) {
        if (metric.type === "number") {
          if (typeof rawValue === "number") {
            return Number.isFinite(rawValue) ? rawValue : null;
          }
          if (typeof rawValue === "string") {
            const text = rawValue.trim();
            if (!text) return null;
            const numeric = Number(text);
            return Number.isFinite(numeric) ? numeric : null;
          }
          return null;
        }
        if (metric.type === "binary") {
          const state = parseBinaryState(rawValue);
          return state === null ? null : state;
        }
        if (metric.type === "enum") {
          const found = metric.options.find((item) => item.value === rawValue);
          return found ? found.value : null;
        }
        return rawValue;
      }

      function sortEntries(entries) {
        return [...entries].sort((a, b) => {
          const dateDiff = String(a.date).localeCompare(String(b.date));
          if (dateDiff !== 0) return dateDiff;
          return String(a.id).localeCompare(String(b.id));
        });
      }

      function getEntries(metricId, data = state.data) {
        const current = data.metrics[metricId];
        if (!Array.isArray(current)) {
          return [];
        }
        return sortEntries(current);
      }

      function setEntries(nextData, metricId, entries) {
        nextData.metrics[metricId] = sortEntries(entries);
      }

      function parseOptionalNumber(raw) {
        if (raw === null || raw === undefined) return null;
        const text = String(raw).trim();
        if (!text) return null;
        const num = Number(text);
        return Number.isFinite(num) ? num : null;
      }

      function parseBinaryState(raw) {
        if (raw === 0 || raw === "0") return 0;
        if (raw === 1 || raw === "1") return 1;
        return null;
      }

      function getMetricSetting(metricId, data = state.data) {
        const source = data && data.metricSettings && typeof data.metricSettings === "object"
          ? data.metricSettings[metricId]
          : null;
        if (!source || typeof source !== "object") {
          return {};
        }
        const setting = {};
        const refLow = parseOptionalNumber(source.refLow);
        const refHigh = parseOptionalNumber(source.refHigh);
        const axisMin = parseOptionalNumber(source.axisMin);
        const axisMax = parseOptionalNumber(source.axisMax);
        const refState = parseBinaryState(source.refState);
        if (refLow !== null) setting.refLow = refLow;
        if (refHigh !== null) setting.refHigh = refHigh;
        if (axisMin !== null) setting.axisMin = axisMin;
        if (axisMax !== null) setting.axisMax = axisMax;
        if (refState !== null) setting.refState = refState;
        return setting;
      }

      function getEffectiveRange(metric, data = state.data) {
        const setting = getMetricSetting(metric.id, data);
        const low = Number.isFinite(setting.refLow) ? setting.refLow : (Number.isFinite(metric.low) ? metric.low : null);
        const high = Number.isFinite(setting.refHigh) ? setting.refHigh : (Number.isFinite(metric.high) ? metric.high : null);
        return { low, high };
      }

      function getBinaryReferenceValue(metric, data = state.data) {
        const setting = getMetricSetting(metric.id, data);
        if (setting.refState === 0 || setting.refState === 1) {
          return setting.refState;
        }
        return 0;
      }

      function formatDate(dateText) {
        return dateText || "--";
      }

      function trimNumberString(num) {
        const text = String(num);
        if (!text.includes(".")) return text;
        return text.replace(/\.?0+$/, "");
      }

      function formatValue(metric, rawValue) {
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          return "--";
        }

        if (metric.type === "number") {
          const num = Number(rawValue);
          if (!Number.isFinite(num)) return "--";
          if (typeof metric.precision === "number") {
            return trimNumberString(num.toFixed(metric.precision));
          }
          return trimNumberString(num);
        }

        if (metric.type === "binary") {
          return Number(rawValue) === 1 ? "阳性" : "阴性";
        }

        if (metric.type === "enum") {
          if (metric.id === "dominant_eye") {
            return rawValue === "right" ? "右" : "左";
          }
          const option = metric.options.find((item) => item.value === rawValue);
          return option ? option.label : "--";
        }

        return String(rawValue);
      }

      function formatDisplayWithUnit(metric, rawValue) {
        const formatted = formatValue(metric, rawValue);
        if (formatted === "--") return "--";
        if (!metric.unit) return formatted;
        if (metric.type !== "number") return formatted;
        return `${formatted} ${metric.unit}`;
      }

      function pickLatestEntry(metricId, data = state.data) {
        const entries = getEntries(metricId, data);
        if (!entries.length) return null;
        return entries[entries.length - 1];
      }

      function metricStatus(metric, rawValue) {
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          return "neutral";
        }

        if (metric.type === "binary") {
          const expected = getBinaryReferenceValue(metric);
          return Number(rawValue) === expected ? "good" : "bad";
        }

        if (metric.type === "enum") {
          if (metric.id === "dominant_eye") return "good";
          return "";
        }

        if (metric.type === "number") {
          const num = Number(rawValue);
          if (!Number.isFinite(num)) return "neutral";
          const range = getEffectiveRange(metric);
          if (Number.isFinite(range.low) && num < range.low) return "bad";
          if (Number.isFinite(range.high) && num > range.high) return "bad";
          if (Number.isFinite(range.low) || Number.isFinite(range.high)) return "good";
          return "good";
        }

        return "neutral";
      }

      function metricTitle(metric) {
        if (metric.short && metric.short !== metric.label) {
          return `${metric.label}/${metric.short}`;
        }
        return metric.label;
      }

      function metricUnit(metric) {
        if (metric.unit) return metric.unit;
        if (metric.type === "binary") return "阴/阳";
        if (metric.type === "enum") return "左/右";
        return "-";
      }

      function metricInputMeta(metric) {
        if (metric.type === "number") {
          const unit = metric.unit || "-";
          if (typeof metric.precision === "number") {
            const stepText = metric.precision === 0
              ? "1"
              : `0.${"0".repeat(Math.max(0, metric.precision - 1))}1`;
            return `${unit} · ${stepText}`;
          }
          return `${unit} · any`;
        }
        if (metric.type === "binary") {
          return "0 / 1";
        }
        if (metric.type === "enum") {
          return "L / R";
        }
        return "";
      }

      function metricValuePlaceholder(metric) {
        if (metric.type !== "number") return "";
        const meta = metricInputMeta(metric);
        return meta ? `Enter value (${meta})` : "Enter value";
      }

      function applyEntryInputHint(metric, message) {
        const valueControl = elements.entryValueField.querySelector("#entryValue");
        if (!valueControl || metric.type !== "number" || !(valueControl instanceof HTMLInputElement)) {
          setFormError(message);
          return;
        }
        valueControl.value = "";
        valueControl.classList.add("input-error");
        valueControl.placeholder = String(message || metricValuePlaceholder(metric));
        valueControl.focus();
      }

      function updateSaveButton(metric) {
        const isAuto = Boolean(metric && metric.autoComputed);
        const disabled = state.isBusy || isAuto;
        const hasHistory = Boolean(metric && getEntries(metric.id).length > 0);
        elements.saveEntryBtn.disabled = disabled;
        elements.pullLastBtn.disabled = disabled || !hasHistory;
        if (isAuto) {
          elements.saveEntryBtn.innerHTML = UI_ICONS.lock;
          elements.saveEntryBtn.title = "Auto";
          elements.saveEntryBtn.setAttribute("aria-label", "Auto");
          elements.pullLastBtn.title = "Auto";
          elements.pullLastBtn.setAttribute("aria-label", "Auto");
          return;
        }
        if (state.isBusy) {
          elements.saveEntryBtn.innerHTML = UI_ICONS.loading;
          elements.saveEntryBtn.title = "Saving";
          elements.saveEntryBtn.setAttribute("aria-label", "Saving");
          elements.pullLastBtn.title = "Busy";
          elements.pullLastBtn.setAttribute("aria-label", "Busy");
          return;
        }
        elements.saveEntryBtn.innerHTML = UI_ICONS.add;
        elements.saveEntryBtn.title = "Add";
        elements.saveEntryBtn.setAttribute("aria-label", "Add");
        elements.pullLastBtn.innerHTML = UI_ICONS.pull;
        elements.pullLastBtn.title = hasHistory ? "Pull latest" : "No history";
        elements.pullLastBtn.setAttribute("aria-label", hasHistory ? "Pull latest" : "No history");
      }

      function applyLatestValueToInput(metric) {
        if (!metric || metric.autoComputed || state.isBusy) {
          return;
        }
        const latest = pickLatestEntry(metric.id);
        if (!latest) {
          return;
        }
        const valueControl = elements.entryValueField.querySelector("#entryValue");
        if (!valueControl) {
          return;
        }
        if (metric.type === "number") {
          valueControl.classList.remove("input-error");
          valueControl.placeholder = metricValuePlaceholder(metric);
          valueControl.value = String(latest.value);
          return;
        }
        valueControl.value = String(latest.value);
      }

      function metricIconKey(metric) {
        if (metric.id === "height") return "ruler";
        if (metric.id === "weight") return "scale";
        if (metric.id === "bmi") return "body";
        if (metric.id === "sbp" || metric.id === "dbp") return "pressure";
        if (metric.id === "dominant_eye") return "dominant";
        if (metric.id === "vision_left" || metric.id === "vision_right") return "eye_corrected";
        if (metric.id.includes("sphere") || metric.id.includes("cylinder")) return "eye_refraction";
        if (metric.id.includes("axis")) return "eye_axis";
        if (metric.id.includes("pupillary")) return "eye_pd";
        if (metric.category === "blood") {
          if (metric.id === "wbc") return "blood_wbc";
          if (BLOOD_BIOCHEM_IDS.has(metric.id)) return "blood_biochem";
          if (BLOOD_PLATELET_IDS.has(metric.id)) return "blood_platelet";
          if (BLOOD_DIFF_IDS.has(metric.id)) return "blood_diff";
          return "blood_rbc";
        }
        if (metric.category === "urine") {
          if (URINE_TUBE_IDS.has(metric.id)) return "urine_tube";
          if (URINE_MICROBE_IDS.has(metric.id)) return "urine_microbe";
          if (URINE_MOLECULE_IDS.has(metric.id)) return "urine_molecule";
          if (URINE_PIGMENT_IDS.has(metric.id)) return "urine_pigment";
          if (metric.id === "bld") return "urine_blood";
          return "urine";
        }
        return "metric";
      }

      function buildCategoryList() {
        CATEGORIES.forEach((category) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "cat-item";
          button.dataset.categoryId = category.id;
          button.style.setProperty("--cat-color", category.color);

          const badge = document.createElement("span");
          badge.className = "cat-badge";

          const label = document.createElement("span");
          label.className = "cat-label";
          label.textContent = category.label;

          const count = document.createElement("span");
          count.className = "cat-count";
          count.textContent = "0";

          button.append(badge, label, count);
          elements.categoryList.appendChild(button);
        });
      }

      function renderCategories() {
        const currentCategory = CATEGORY_MAP.get(state.activeCategory);
        elements.categoryTitle.textContent = currentCategory ? currentCategory.label : "分类";

        elements.categoryList.querySelectorAll(".cat-item").forEach((button) => {
          const selected = button.dataset.categoryId === state.activeCategory;
          button.classList.toggle("active", selected);
          button.setAttribute("aria-pressed", selected ? "true" : "false");

          const countNode = button.querySelector(".cat-count");
          if (countNode) {
            const categoryId = button.dataset.categoryId;
            const count = FIXED_METRICS.filter((metric) => metric.category === categoryId).length;
            countNode.textContent = `${count}`;
          }
        });
      }

      function renderCards() {
        const metrics = FIXED_METRICS.filter((metric) => metric.category === state.activeCategory);
        const fragment = document.createDocumentFragment();

        metrics.forEach((metric) => {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "metric-card";
          card.dataset.metricId = metric.id;

          const latest = pickLatestEntry(metric.id);
          const value = latest ? latest.value : null;
          const displayValue = formatValue(metric, value);

          const icon = document.createElement("span");
          icon.className = "metric-icon";
          icon.dataset.category = metric.category;
          icon.innerHTML = ICON_SVGS[metricIconKey(metric)] || ICON_SVGS.metric;

          const name = document.createElement("span");
          name.className = "metric-name";
          name.textContent = metricTitle(metric);

          const valueNode = document.createElement("span");
          const statusClass = metricStatus(metric, value);
          const valueClasses = ["metric-value"];
          if (statusClass) valueClasses.push(statusClass);
          if (metric.type === "enum") valueClasses.push("metric-value-enum");
          valueNode.className = valueClasses.join(" ");
          valueNode.textContent = displayValue;

          const valueLine = document.createElement("span");
          valueLine.className = "metric-value-line";
          valueLine.appendChild(valueNode);
          if (displayValue !== "--" && metric.type === "number" && metric.unit) {
            const unitInline = document.createElement("span");
            unitInline.className = "metric-unit-inline";
            unitInline.textContent = metric.unit;
            valueLine.appendChild(unitInline);
          }

          const dateNode = document.createElement("span");
          dateNode.className = "metric-date";
          const dateIcon = document.createElement("span");
          dateIcon.innerHTML = UI_ICONS.date;
          const dateText = document.createElement("span");
          dateText.textContent = latest ? formatDate(latest.date) : "--";
          dateNode.append(dateIcon, dateText);

          card.append(icon, name, valueLine, dateNode);
          fragment.appendChild(card);
        });

        elements.cards.innerHTML = "";
        elements.cards.appendChild(fragment);
      }

      function showMessage(text) {
        state.message = text;
        if (!text) {
          elements.notice.classList.remove("visible");
          elements.notice.textContent = "";
          return;
        }
        elements.notice.textContent = text;
        elements.notice.classList.add("visible");
      }

      async function saveRangeConfig(metricId, nextSetting) {
        const metric = METRIC_MAP.get(metricId);
        if (!metric || (metric.type !== "number" && metric.type !== "binary")) {
          return;
        }

        const nextData = cloneData(state.data);
        if (!nextData.metricSettings || typeof nextData.metricSettings !== "object") {
          nextData.metricSettings = {};
        }

        if (metric.type === "binary") {
          const refState = parseBinaryState(nextSetting ? nextSetting.refState : null);
          if (refState === null) {
            delete nextData.metricSettings[metricId];
          } else {
            nextData.metricSettings[metricId] = { refState };
          }
          const saved = await persistData(nextData);
          if (saved) {
            renderAll();
          }
          return;
        }

        const parsedRefLow = parseOptionalNumber(nextSetting ? nextSetting.refLow : null);
        const parsedRefHigh = parseOptionalNumber(nextSetting ? nextSetting.refHigh : null);
        const parsedAxisMin = parseOptionalNumber(nextSetting ? nextSetting.axisMin : null);
        const parsedAxisMax = parseOptionalNumber(nextSetting ? nextSetting.axisMax : null);

        const hasRefLow = parsedRefLow !== null;
        const hasRefHigh = parsedRefHigh !== null;
        const hasAxis = parsedAxisMin !== null || parsedAxisMax !== null;

        if (!hasRefLow && !hasRefHigh && !hasAxis) {
          delete nextData.metricSettings[metricId];
        } else {
          const records = getEntries(metricId, nextData);
          const normalized = computeChartBounds(
            metric,
            records,
            {
              refLow: parsedRefLow,
              refHigh: parsedRefHigh,
              axisMin: parsedAxisMin,
              axisMax: parsedAxisMax
            },
            {
              low: Number.isFinite(metric.low) ? metric.low : null,
              high: Number.isFinite(metric.high) ? metric.high : null
            }
          );

          const finalSetting = {};
          if (hasRefLow && Number.isFinite(normalized.refLow)) finalSetting.refLow = normalized.refLow;
          if (hasRefHigh && Number.isFinite(normalized.refHigh)) finalSetting.refHigh = normalized.refHigh;
          if (hasAxis) {
            finalSetting.axisMin = normalized.minValue;
            finalSetting.axisMax = normalized.maxValue;
          }
          nextData.metricSettings[metricId] = finalSetting;
        }

        const saved = await persistData(nextData);
        if (saved) {
          renderAll();
        }
      }

      function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function computeChartBounds(metric, records, setting = getMetricSetting(metric.id), range = getEffectiveRange(metric)) {
        if (metric.type !== "number") {
          return {
            minValue: 0,
            maxValue: 1,
            refLow: Number.isFinite(range.low) ? range.low : null,
            refHigh: Number.isFinite(range.high) ? range.high : null
          };
        }

        const points = records
          .map((entry) => Number(entry.value))
          .filter((value) => Number.isFinite(value));
        let refLow = parseOptionalNumber(setting.refLow);
        let refHigh = parseOptionalNumber(setting.refHigh);
        if (refLow === null && Number.isFinite(range.low)) refLow = range.low;
        if (refHigh === null && Number.isFinite(range.high)) refHigh = range.high;
        if (refLow !== null && refHigh !== null && refLow > refHigh) {
          [refLow, refHigh] = [refHigh, refLow];
        }

        const axisMinInput = parseOptionalNumber(setting.axisMin);
        const axisMaxInput = parseOptionalNumber(setting.axisMax);

        const coverageValues = [
          ...points,
          ...(Number.isFinite(refLow) ? [refLow] : []),
          ...(Number.isFinite(refHigh) ? [refHigh] : [])
        ];

        let maxLowerBound = null;
        let minUpperBound = null;
        let axisMin = axisMinInput;
        let axisMax = axisMaxInput;

        if (coverageValues.length) {
          const coverageMin = Math.min(...coverageValues);
          const coverageMax = Math.max(...coverageValues);
          const coverageSpan = Math.max(1, coverageMax - coverageMin);
          const coveragePadding = Math.max(coverageSpan * 0.12, 0.5);

          maxLowerBound = coverageMin - coveragePadding;
          minUpperBound = coverageMax + coveragePadding;

          axisMin = axisMinInput === null ? maxLowerBound : Math.min(axisMinInput, maxLowerBound);
          axisMax = axisMaxInput === null ? minUpperBound : Math.max(axisMaxInput, minUpperBound);
        } else {
          if (axisMin === null && axisMax === null) {
            axisMin = 0;
            axisMax = 1;
          } else if (axisMin === null && axisMax !== null) {
            axisMin = axisMax - 1;
          } else if (axisMax === null && axisMin !== null) {
            axisMax = axisMin + 1;
          }
        }

        if (!Number.isFinite(axisMin)) axisMin = 0;
        if (!Number.isFinite(axisMax)) axisMax = axisMin + 1;
        if (axisMin >= axisMax) {
          const center = coverageValues.length
            ? (Math.min(...coverageValues) + Math.max(...coverageValues)) / 2
            : (axisMin + axisMax) / 2;
          axisMin = center - 0.5;
          axisMax = center + 0.5;
        }

        if (refLow !== null) refLow = clampNumber(refLow, axisMin, axisMax);
        if (refHigh !== null) refHigh = clampNumber(refHigh, axisMin, axisMax);
        if (refLow !== null && refHigh !== null && refLow > refHigh) {
          [refLow, refHigh] = [refHigh, refLow];
        }

        return {
          minValue: axisMin,
          maxValue: axisMax,
          refLow,
          refHigh,
          maxLowerBound,
          minUpperBound
        };
      }

      function renderRangeEditor(metric) {
        elements.rangeEditor.innerHTML = "";
        if (metric.type !== "number" && metric.type !== "binary") {
          elements.rangeEditor.classList.add("hidden");
          return;
        }
        elements.rangeEditor.classList.remove("hidden");

        if (metric.type === "binary") {
          const setting = getMetricSetting(metric.id);
          const currentRef = setting.refState === 1 ? "1" : "0";

          const refSelect = document.createElement("select");
          refSelect.className = "range-input range-select";
          refSelect.innerHTML = `
            <option value="0">Ref: 阴性</option>
            <option value="1">Ref: 阳性</option>
          `;
          refSelect.value = currentRef;

          const saveBtn = document.createElement("button");
          saveBtn.type = "button";
          saveBtn.className = "range-save-btn";
          saveBtn.innerHTML = UI_ICONS.save;
          saveBtn.title = "Apply";
          saveBtn.setAttribute("aria-label", "Apply");
          saveBtn.disabled = state.isBusy;
          saveBtn.addEventListener("click", async () => {
            await saveRangeConfig(metric.id, { refState: refSelect.value });
          });

          const wrap = document.createElement("label");
          wrap.className = "range-item";
          wrap.title = "Reference";
          const icon = document.createElement("span");
          icon.className = "range-item-icon";
          icon.innerHTML = UI_ICONS.refLow;
          wrap.append(icon, refSelect);

          elements.rangeEditor.append(wrap, saveBtn);
          return;
        }

        const records = getEntries(metric.id);
        const setting = getMetricSetting(metric.id);
        const defaults = getEffectiveRange(metric);
        const bounds = computeChartBounds(metric, records, setting, defaults);
        const refLowInput = document.createElement("input");
        refLowInput.className = "range-input";
        refLowInput.type = "number";
        refLowInput.step = "any";
        refLowInput.placeholder = "Ref Low";
        refLowInput.value = Number.isFinite(bounds.refLow) ? trimNumberString(bounds.refLow.toFixed(4)) : "";

        const refHighInput = document.createElement("input");
        refHighInput.className = "range-input";
        refHighInput.type = "number";
        refHighInput.step = "any";
        refHighInput.placeholder = "Ref High";
        refHighInput.value = Number.isFinite(bounds.refHigh) ? trimNumberString(bounds.refHigh.toFixed(4)) : "";

        const axisMinInput = document.createElement("input");
        axisMinInput.className = "range-input";
        axisMinInput.type = "number";
        axisMinInput.step = "any";
        axisMinInput.placeholder = "Y Min";
        axisMinInput.value = Number.isFinite(bounds.minValue) ? trimNumberString(bounds.minValue.toFixed(4)) : "";

        const axisMaxInput = document.createElement("input");
        axisMaxInput.className = "range-input";
        axisMaxInput.type = "number";
        axisMaxInput.step = "any";
        axisMaxInput.placeholder = "Y Max";
        axisMaxInput.value = Number.isFinite(bounds.maxValue) ? trimNumberString(bounds.maxValue.toFixed(4)) : "";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "range-save-btn";
        saveBtn.innerHTML = UI_ICONS.save;
        saveBtn.title = "Apply";
        saveBtn.setAttribute("aria-label", "Apply");
        saveBtn.disabled = state.isBusy;
        saveBtn.addEventListener("click", async () => {
          let refLow = parseOptionalNumber(refLowInput.value);
          let refHigh = parseOptionalNumber(refHighInput.value);
          let axisMin = parseOptionalNumber(axisMinInput.value);
          let axisMax = parseOptionalNumber(axisMaxInput.value);

          if (refLow !== null && refHigh !== null && refLow > refHigh) {
            [refLow, refHigh] = [refHigh, refLow];
          }
          if (axisMin !== null && axisMax !== null && axisMin > axisMax) {
            [axisMin, axisMax] = [axisMax, axisMin];
          }

          const nextSetting = {};
          if (refLow !== null) nextSetting.refLow = refLow;
          if (refHigh !== null) nextSetting.refHigh = refHigh;
          if (axisMin !== null) nextSetting.axisMin = axisMin;
          if (axisMax !== null) nextSetting.axisMax = axisMax;
          await saveRangeConfig(metric.id, nextSetting);
        });

        const makeRangeItem = (iconSvg, title, input) => {
          const wrap = document.createElement("label");
          wrap.className = "range-item";
          wrap.title = title;
          const icon = document.createElement("span");
          icon.className = "range-item-icon";
          icon.innerHTML = iconSvg;
          wrap.append(icon, input);
          return wrap;
        };

        elements.rangeEditor.append(
          makeRangeItem(UI_ICONS.refLow, "Reference Low", refLowInput),
          makeRangeItem(UI_ICONS.refHigh, "Reference High", refHighInput),
          makeRangeItem(UI_ICONS.axisMin, "Y Axis Min", axisMinInput),
          makeRangeItem(UI_ICONS.axisMax, "Y Axis Max", axisMaxInput),
          saveBtn
        );
      }

      function renderModal() {
        if (!state.activeMetricId) {
          elements.modalBackdrop.classList.remove("open");
          return;
        }

        const metric = METRIC_MAP.get(state.activeMetricId);
        if (!metric) {
          elements.modalBackdrop.classList.remove("open");
          return;
        }

        elements.modalBackdrop.classList.add("open");
        elements.modalTitle.textContent = metricTitle(metric);
        renderRangeEditor(metric);
        elements.entryDate.value = TODAY_STR;
        elements.entryDate.max = TODAY_STR;
        renderEntryValueInput(metric);
        renderChart(metric);
        renderEntryList(metric);
        setFormError("");
      }

      function renderEntryValueInput(metric, editValue) {
        let control;
        if (metric.type === "number") {
          control = document.createElement("input");
          control.id = "entryValue";
          control.className = "input";
          control.type = "number";
          control.placeholder = metricValuePlaceholder(metric);
          control.required = true;
          control.addEventListener("input", () => {
            control.classList.remove("input-error");
            control.placeholder = metricValuePlaceholder(metric);
          });
          if (typeof metric.precision === "number") {
            const decimals = Math.max(metric.precision, 0);
            control.step = decimals === 0 ? "1" : `0.${"0".repeat(Math.max(0, decimals - 1))}1`;
          } else {
            control.step = "any";
          }
          if (Number.isFinite(metric.inputMin)) control.min = String(metric.inputMin);
          if (Number.isFinite(metric.inputMax)) control.max = String(metric.inputMax);
          if (editValue !== undefined) {
            control.value = String(editValue);
          }
        } else {
          control = document.createElement("select");
          control.id = "entryValue";
          control.className = "select";
          control.required = true;

          const options = metric.type === "binary"
            ? [
                { value: "0", label: "阴性" },
                { value: "1", label: "阳性" }
              ]
            : metric.options;

          options.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            control.appendChild(option);
          });

          if (editValue !== undefined) {
            control.value = String(editValue);
          }
        }

        elements.entryValueField.innerHTML = "";
        elements.entryValueField.append(control);
        updateSaveButton(metric);
      }

      function parseInputValue(metric, rawValue) {
        if (metric.type === "number") {
          if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") {
            throw new Error("Enter value");
          }
          const numeric = Number(rawValue);
          if (!Number.isFinite(numeric)) {
            throw new Error("Enter a valid number");
          }
          if (Number.isFinite(metric.inputMin) && numeric < metric.inputMin) {
            throw new Error(`Value must be >= ${metric.inputMin}`);
          }
          if (Number.isFinite(metric.inputMax) && numeric > metric.inputMax) {
            throw new Error(`Value must be <= ${metric.inputMax}`);
          }
          return numeric;
        }

        if (metric.type === "binary") {
          if (!(rawValue === "0" || rawValue === "1" || rawValue === 0 || rawValue === 1)) {
            throw new Error("请选择阴性或阳性");
          }
          return Number(rawValue);
        }

        if (metric.type === "enum") {
          const found = metric.options.find((item) => item.value === rawValue);
          if (!found) {
            throw new Error("请选择有效选项");
          }
          return rawValue;
        }

        return rawValue;
      }

      function syncDominantEye(nextData) {
        const dominantRecords = getEntries("dominant_eye", nextData);
        const latest = dominantRecords.length ? dominantRecords[dominantRecords.length - 1].value : null;
        nextData.dominantEye = latest === "left" || latest === "right" ? latest : null;
      }

      function recalcBmi(nextData) {
        const heightEntries = getEntries("height", nextData);
        const weightEntries = getEntries("weight", nextData);

        if (!heightEntries.length || !weightEntries.length) {
          nextData.metrics.bmi = [];
          return;
        }

        const bmiEntries = [];

        weightEntries.forEach((weightRecord) => {
          const availableHeight = heightEntries.filter((heightRecord) => heightRecord.date <= weightRecord.date);
          if (!availableHeight.length) {
            return;
          }
          const heightRecord = availableHeight[availableHeight.length - 1];
          const heightMeters = Number(heightRecord.value) / 100;
          const weightKg = Number(weightRecord.value);
          if (!(heightMeters > 0 && Number.isFinite(weightKg))) {
            return;
          }

          const bmi = weightKg / (heightMeters * heightMeters);
          bmiEntries.push({
            id: `bmi-${weightRecord.id}`,
            date: weightRecord.date,
            value: Number(bmi.toFixed(4)),
            generated: true
          });
        });

        setEntries(nextData, "bmi", bmiEntries);
      }

      function reconcileMetricSettings(nextData) {
        if (!nextData.metricSettings || typeof nextData.metricSettings !== "object") {
          return;
        }

        Object.keys(nextData.metricSettings).forEach((metricId) => {
          const metric = METRIC_MAP.get(metricId);
          if (!metric) {
            delete nextData.metricSettings[metricId];
            return;
          }

          if (metric.type === "binary") {
            const rawSetting = getMetricSetting(metricId, nextData);
            const refState = parseBinaryState(rawSetting.refState);
            if (refState === null) {
              delete nextData.metricSettings[metricId];
              return;
            }
            nextData.metricSettings[metricId] = { refState };
            return;
          }

          if (metric.type !== "number") {
            delete nextData.metricSettings[metricId];
            return;
          }

          const rawSetting = getMetricSetting(metricId, nextData);
          const hasRefLow = parseOptionalNumber(rawSetting.refLow) !== null;
          const hasRefHigh = parseOptionalNumber(rawSetting.refHigh) !== null;
          const hasAxis = parseOptionalNumber(rawSetting.axisMin) !== null || parseOptionalNumber(rawSetting.axisMax) !== null;

          if (!hasRefLow && !hasRefHigh && !hasAxis) {
            delete nextData.metricSettings[metricId];
            return;
          }

          const records = getEntries(metricId, nextData);
          const normalized = computeChartBounds(
            metric,
            records,
            rawSetting,
            {
              low: Number.isFinite(metric.low) ? metric.low : null,
              high: Number.isFinite(metric.high) ? metric.high : null
            }
          );

          const nextSetting = {};
          if (hasRefLow && Number.isFinite(normalized.refLow)) nextSetting.refLow = normalized.refLow;
          if (hasRefHigh && Number.isFinite(normalized.refHigh)) nextSetting.refHigh = normalized.refHigh;
          if (hasAxis) {
            nextSetting.axisMin = normalized.minValue;
            nextSetting.axisMax = normalized.maxValue;
          }

          if (Object.keys(nextSetting).length === 0) {
            delete nextData.metricSettings[metricId];
            return;
          }
          nextData.metricSettings[metricId] = nextSetting;
        });
      }

      const createBodyMetricsStorageApi = window.createLeeOSBodyMetricsStorageAPI
      if (!createBodyMetricsStorageApi) {
        throw new Error('Body Metrics storage module is not loaded')
      }
      const {
        canPersist,
        isMissingFileError,
        withTimeout,
        readStorageJson,
        writeStorageJson,
        setBusy,
        persistData,
      } = createBodyMetricsStorageApi({
        DATA_FILE,
        state,
        METRIC_MAP,
        updateSaveButton,
      })


      function setFormError(message = "") {
        if (!elements.formError) {
          return;
        }
        const text = String(message || "").trim();
        elements.formError.textContent = text;
        elements.formError.classList.toggle("visible", Boolean(text));
      }

      function openMetric(metricId) {
        state.activeMetricId = metricId;
        state.pendingDeleteId = null;
        state.editingEntryId = null;
        renderModal();
      }

      function closeMetricModal() {
        state.activeMetricId = null;
        state.pendingDeleteId = null;
        state.editingEntryId = null;
        setFormError("");
        elements.modalBackdrop.classList.remove("open");
      }

      function renderAll() {
        renderCategories();
        renderCards();
        if (state.activeMetricId) {
          renderModal();
        }
      }

      function getChartValue(metric, rawValue) {
        if (metric.type === "number") {
          return Number(rawValue);
        }
        if (metric.type === "binary") {
          return Number(rawValue) === 1 ? 1 : 0;
        }
        if (metric.type === "enum") {
          return rawValue === "right" ? 1 : 0;
        }
        return Number(rawValue);
      }

      function getYAxisLabel(metric, value) {
        if (metric.type === "binary") {
          return value >= 0.5 ? "阳" : "阴";
        }
        if (metric.type === "enum") {
          return value >= 0.5 ? "右" : "左";
        }
        return trimNumberString(value.toFixed(2));
      }

      function drawText(svg, attrs, text) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        node.textContent = text;
        svg.appendChild(node);
      }

      function drawLine(svg, attrs) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "line");
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        svg.appendChild(node);
      }

      function drawCircle(svg, attrs) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        svg.appendChild(node);
      }

      function drawPolyline(svg, attrs) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        svg.appendChild(node);
      }

      function readCssVar(name, fallback) {
        const rootStyle = window.getComputedStyle(document.documentElement);
        const value = rootStyle.getPropertyValue(name).trim();
        return value || fallback;
      }

      function getChartPalette() {
        return {
          axis: readCssVar("--chart-axis", "#9ba8be"),
          grid: readCssVar("--chart-grid", "rgba(149, 162, 185, 0.22)"),
          label: readCssVar("--chart-label", "#8692a8"),
          refLine: readCssVar("--chart-ref-line", "#de9a57"),
          refText: readCssVar("--chart-ref-text", "#c88443"),
          lineState: readCssVar("--chart-line-state", "#6f8fb8"),
          lineRanged: readCssVar("--chart-line-ranged", "#e8707c"),
          lineUnranged: readCssVar("--chart-line-unranged", "#5aa96f"),
          pointGood: readCssVar("--chart-point-good", "#2d9b64"),
          pointBad: readCssVar("--chart-point-bad", "#df4a61"),
          pointEnumLeft: readCssVar("--chart-point-enum-left", "#6eb59f"),
          pointEnumRight: readCssVar("--chart-point-enum-right", "#5f97d8"),
          pointStroke: readCssVar("--chart-point-stroke", "#ffffff")
        };
      }

      function hideChartTip() {
        if (!elements.chartTip) return;
        elements.chartTip.classList.remove("visible");
      }

      function hideChartEmpty() {
        if (!elements.chartEmpty) return;
        elements.chartEmpty.classList.remove("visible");
        elements.chartEmpty.innerHTML = "";
      }

      function showChartEmpty(title, subText) {
        if (!elements.chartEmpty) return;
        elements.chartEmpty.innerHTML = `
          <div class="chart-empty-content">
            <span class="chart-empty-icon">${UI_ICONS.trend}</span>
            <span class="chart-empty-title">${title}</span>
            <span class="chart-empty-sub">${subText}</span>
          </div>
        `;
        elements.chartEmpty.classList.add("visible");
      }

      function showChartTip(pointNode, clientX, clientY) {
        if (!elements.chartTip || !elements.chart || !(elements.chart.parentElement instanceof HTMLElement)) return;
        const rawDate = pointNode.getAttribute("data-date") || "--";
        const rawValue = pointNode.getAttribute("data-value") || "--";
        elements.chartTip.textContent = `${rawDate} · ${rawValue}`;
        elements.chartTip.classList.add("visible");

        const wrapRect = elements.chart.parentElement.getBoundingClientRect();
        const tipRect = elements.chartTip.getBoundingClientRect();
        const localX = clientX - wrapRect.left;
        const localY = clientY - wrapRect.top;
        const halfWidth = tipRect.width / 2;
        const safeX = Math.max(halfWidth + 6, Math.min(wrapRect.width - halfWidth - 6, localX));
        const safeY = Math.max(tipRect.height + 6, localY - 12);

        elements.chartTip.style.left = `${safeX}px`;
        elements.chartTip.style.top = `${safeY}px`;
      }

      function renderChart(metric) {
        const svg = elements.chart;
        svg.innerHTML = "";
        hideChartTip();
        hideChartEmpty();
        const palette = getChartPalette();
        const setting = getMetricSetting(metric.id);
        const range = getEffectiveRange(metric);

        const records = getEntries(metric.id);
        if (!records.length) {
          showChartEmpty("No trend data", "Add your first record below");
          return;
        }

        const width = 860;
        const height = 320;
        const left = 68;
        const right = 24;
        const top = 20;
        const bottom = 48;
        const chartWidth = width - left - right;
        const chartHeight = height - top - bottom;
        const xInset = 12;

        const pointsRaw = records.map((entry, index) => ({
          entry,
          index,
          value: getChartValue(metric, entry.value)
        })).filter((item) => Number.isFinite(item.value));

        if (!pointsRaw.length) {
          showChartEmpty("Cannot plot", "Check value format");
          return;
        }

        const bounds = computeChartBounds(metric, records, setting, range);
        const minValue = bounds.minValue;
        const maxValue = bounds.maxValue;
        const refLow = bounds.refLow;
        const refHigh = bounds.refHigh;
        const isStateMetric = metric.type === "binary" || metric.type === "enum";

        const yPosition = (value) => top + ((maxValue - value) / (maxValue - minValue)) * chartHeight;
        const xPosition = (index) => {
          if (pointsRaw.length === 1) {
            return left + chartWidth / 2;
          }
          const usableWidth = Math.max(2, chartWidth - xInset * 2);
          const step = usableWidth / (pointsRaw.length - 1);
          return left + xInset + index * step;
        };

        const axisColor = palette.axis;
        drawLine(svg, { x1: left, y1: top, x2: left, y2: top + chartHeight, stroke: axisColor, "stroke-width": 1.2 });
        drawLine(svg, { x1: left, y1: top + chartHeight, x2: left + chartWidth, y2: top + chartHeight, stroke: axisColor, "stroke-width": 1.2 });

        if (isStateMetric) {
          [1, 0].forEach((stateValue) => {
            const y = yPosition(stateValue);
            drawLine(svg, { x1: left, y1: y, x2: left + chartWidth, y2: y, stroke: palette.grid, "stroke-width": 1 });
            drawText(svg, {
              x: left - 8,
              y: y + 4,
              "text-anchor": "end",
              fill: palette.label,
              "font-size": "11"
            }, getYAxisLabel(metric, stateValue));
          });
        } else {
          const yTicks = 5;
          for (let i = 0; i <= yTicks; i += 1) {
            const ratio = i / yTicks;
            const value = maxValue - (maxValue - minValue) * ratio;
            const y = yPosition(value);
            drawLine(svg, { x1: left, y1: y, x2: left + chartWidth, y2: y, stroke: palette.grid, "stroke-width": 1 });
            drawText(svg, {
              x: left - 8,
              y: y + 4,
              "text-anchor": "end",
              fill: palette.label,
              "font-size": "11"
            }, getYAxisLabel(metric, value));
          }
        }

        if (metric.type === "number" && Number.isFinite(refLow)) {
          const y = yPosition(refLow);
          drawLine(svg, {
            x1: left,
            y1: y,
            x2: left + chartWidth,
            y2: y,
            stroke: palette.refLine,
            "stroke-width": 1.5,
            "stroke-dasharray": "5 4"
          });
          drawText(svg, {
            x: left + chartWidth - 4,
            y: y - 4,
            "text-anchor": "end",
            fill: palette.refText,
            "font-size": "11"
          }, trimNumberString(refLow));
        }

        if (metric.type === "number" && Number.isFinite(refHigh)) {
          const y = yPosition(refHigh);
          drawLine(svg, {
            x1: left,
            y1: y,
            x2: left + chartWidth,
            y2: y,
            stroke: palette.refLine,
            "stroke-width": 1.5,
            "stroke-dasharray": "5 4"
          });
          drawText(svg, {
            x: left + chartWidth - 4,
            y: y - 4,
            "text-anchor": "end",
            fill: palette.refText,
            "font-size": "11"
          }, trimNumberString(refHigh));
        }

        const lineColor = isStateMetric
          ? palette.lineState
          : metric.type === "number" && !(Number.isFinite(refLow) && Number.isFinite(refHigh))
          ? palette.lineUnranged
          : palette.lineRanged;
        if (pointsRaw.length > 1) {
          const polyPoints = isStateMetric
            ? pointsRaw.map((point, index) => {
                const x = xPosition(point.index);
                const y = yPosition(point.value);
                const seg = [`${x},${y}`];
                if (index < pointsRaw.length - 1) {
                  const nextX = xPosition(pointsRaw[index + 1].index);
                  seg.push(`${nextX},${y}`);
                }
                return seg.join(" ");
              }).join(" ")
            : pointsRaw.map((point) => `${xPosition(point.index)},${yPosition(point.value)}`).join(" ");

          drawPolyline(svg, {
            points: polyPoints,
            fill: "none",
            stroke: lineColor,
            "stroke-width": 2.2,
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          });
        }

        pointsRaw.forEach((point) => {
          const x = xPosition(point.index);
          const y = yPosition(point.value);

          let pointColor = lineColor;
          if (metric.type === "binary") {
            const expected = getBinaryReferenceValue(metric);
            pointColor = point.value === expected ? palette.pointGood : palette.pointBad;
          } else if (metric.type === "enum") {
            pointColor = point.value === 1 ? palette.pointEnumRight : palette.pointEnumLeft;
          } else if (metric.type === "number" && Number.isFinite(refLow) && Number.isFinite(refHigh)) {
            pointColor = point.value < refLow || point.value > refHigh ? palette.pointBad : palette.pointGood;
          }

          drawCircle(svg, {
            cx: x,
            cy: y,
            r: 3.9,
            class: "chart-point",
            "data-date": point.entry.date,
            "data-value": formatDisplayWithUnit(metric, point.entry.value),
            fill: pointColor,
            stroke: palette.pointStroke,
            "stroke-width": 1.2
          });
        });

        const labelLimit = 7;
        const step = Math.max(1, Math.ceil(pointsRaw.length / labelLimit));
        pointsRaw.forEach((point) => {
          const isLast = point.index === pointsRaw.length - 1;
          const isFirst = point.index === 0;
          if (point.index % step !== 0 && !isLast && !isFirst) {
            return;
          }
          let x = xPosition(point.index);
          let anchor = "middle";
          if (isFirst) {
            x = left + 6;
            anchor = "start";
          } else if (isLast) {
            x = left + chartWidth - 6;
            anchor = "end";
          }
          drawText(svg, {
            x,
            y: top + chartHeight + 18,
            "text-anchor": anchor,
            fill: palette.label,
            "font-size": "11"
          }, point.entry.date);
        });
      }

      function buildEntryValueField(metric, currentValue, compact = false) {
        if (metric.type === "number") {
          const input = document.createElement("input");
          input.type = "number";
          input.className = compact ? "small-input" : "input";
          input.placeholder = metricValuePlaceholder(metric);
          if (typeof metric.precision === "number") {
            const decimals = Math.max(metric.precision, 0);
            input.step = decimals === 0 ? "1" : `0.${"0".repeat(Math.max(0, decimals - 1))}1`;
          } else {
            input.step = "any";
          }
          if (Number.isFinite(metric.inputMin)) input.min = String(metric.inputMin);
          if (Number.isFinite(metric.inputMax)) input.max = String(metric.inputMax);
          if (currentValue !== undefined && currentValue !== null) {
            input.value = String(currentValue);
          }
          return input;
        }

        const select = document.createElement("select");
        select.className = compact ? "small-select" : "select";

        const options = metric.type === "binary"
          ? [
              { value: "0", label: "阴性" },
              { value: "1", label: "阳性" }
            ]
          : metric.options;

        options.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.value;
          option.textContent = item.label;
          select.appendChild(option);
        });

        if (currentValue !== undefined && currentValue !== null) {
          select.value = String(currentValue);
        }

        return select;
      }

      function renderEntryList(metric) {
        const records = getEntries(metric.id).slice().reverse();
        elements.entries.innerHTML = "";

        if (!records.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.innerHTML = metric.autoComputed
            ? `<span class="empty-state-icon">${UI_ICONS.lock}</span><span class="empty-state-text"><span class="empty-state-title">No history</span><span class="empty-state-sub">Auto from height & weight</span></span>`
            : `<span class="empty-state-icon">${UI_ICONS.inbox}</span><span class="empty-state-text"><span class="empty-state-title">No records</span><span class="empty-state-sub">Add one above</span></span>`;
          elements.entries.appendChild(empty);
          return;
        }

        records.forEach((record) => {
          const row = document.createElement("div");
          row.className = "entry-row";
          row.dataset.entryId = record.id;

          if (state.editingEntryId === record.id) {
            const dateInput = document.createElement("input");
            dateInput.type = "date";
            dateInput.value = record.date;
            dateInput.max = TODAY_STR;
            dateInput.className = "small-input";
            dateInput.dataset.role = "edit-date";

            const valueControl = buildEntryValueField(metric, record.value, true);
            valueControl.dataset.role = "edit-value";

            const actionArea = document.createElement("div");
            actionArea.className = "entry-actions";

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "confirm-btn";
            saveBtn.innerHTML = UI_ICONS.check;
            saveBtn.title = "Save";
            saveBtn.setAttribute("aria-label", "Save");
            saveBtn.dataset.action = "save-edit";
            saveBtn.dataset.entryId = record.id;
            saveBtn.disabled = state.isBusy;

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "ghost-btn";
            cancelBtn.innerHTML = UI_ICONS.close;
            cancelBtn.title = "Cancel";
            cancelBtn.setAttribute("aria-label", "Cancel");
            cancelBtn.dataset.action = "cancel-edit";
            cancelBtn.disabled = state.isBusy;

            actionArea.append(saveBtn, cancelBtn);
            row.append(dateInput, valueControl, actionArea);
          } else {
            const dateNode = document.createElement("div");
            dateNode.className = "entry-date";
            dateNode.textContent = record.date;

            const valueNode = document.createElement("div");
            valueNode.className = "entry-value";
            valueNode.textContent = formatDisplayWithUnit(metric, record.value);

            const actions = document.createElement("div");
            actions.className = "entry-actions";

            if (!metric.autoComputed && state.pendingDeleteId !== record.id) {
              const editBtn = document.createElement("button");
              editBtn.type = "button";
              editBtn.className = "ghost-btn";
              editBtn.innerHTML = UI_ICONS.edit;
              editBtn.title = "Edit";
              editBtn.setAttribute("aria-label", "Edit");
              editBtn.dataset.action = "edit";
              editBtn.dataset.entryId = record.id;
              editBtn.disabled = state.isBusy;

              actions.appendChild(editBtn);
            }

            if (state.pendingDeleteId === record.id) {
              const confirmBtn = document.createElement("button");
              confirmBtn.type = "button";
              confirmBtn.className = "confirm-btn";
              confirmBtn.innerHTML = UI_ICONS.check;
              confirmBtn.title = "Confirm";
              confirmBtn.setAttribute("aria-label", "Confirm");
              confirmBtn.dataset.action = "confirm-delete";
              confirmBtn.dataset.entryId = record.id;
              confirmBtn.disabled = state.isBusy;

              const cancelBtn = document.createElement("button");
              cancelBtn.type = "button";
              cancelBtn.className = "danger-btn";
              cancelBtn.innerHTML = UI_ICONS.close;
              cancelBtn.title = "Cancel";
              cancelBtn.setAttribute("aria-label", "Cancel");
              cancelBtn.dataset.action = "cancel-delete";
              cancelBtn.disabled = state.isBusy;

              actions.append(confirmBtn, cancelBtn);
            } else if (!metric.autoComputed) {
              const deleteBtn = document.createElement("button");
              deleteBtn.type = "button";
              deleteBtn.className = "danger-btn";
              deleteBtn.innerHTML = UI_ICONS.delete;
              deleteBtn.title = "Delete";
              deleteBtn.setAttribute("aria-label", "Delete");
              deleteBtn.dataset.action = "delete";
              deleteBtn.dataset.entryId = record.id;
              deleteBtn.disabled = state.isBusy;
              actions.appendChild(deleteBtn);
            }

            row.append(dateNode, valueNode, actions);
          }

          elements.entries.appendChild(row);
        });
      }

      async function createEntry(metric, dateText, rawValue) {
        if (!dateText) {
          throw new Error("请选择日期");
        }
        if (!isValidDateText(dateText)) {
          throw new Error("日期格式无效");
        }
        if (isFutureDate(dateText)) {
          throw new Error("日期不能晚于今天");
        }
        const parsedValue = parseInputValue(metric, rawValue);

        const nextData = cloneData(state.data);
        const currentEntries = getEntries(metric.id, nextData);
        const nextEntries = [...currentEntries, {
          id: makeId(),
          date: dateText,
          value: parsedValue
        }];

        setEntries(nextData, metric.id, nextEntries);

        if (metric.id === "dominant_eye") {
          syncDominantEye(nextData);
        }

        if (metric.id === "height" || metric.id === "weight") {
          recalcBmi(nextData);
        }
        reconcileMetricSettings(nextData);

        const saved = await persistData(nextData);
        if (!saved) {
          throw new Error(`保存失败：${state.lastPersistError || "未知错误"}`);
        }

        state.pendingDeleteId = null;
        state.editingEntryId = null;
        setFormError("");
        renderAll();
      }

      async function saveEditedEntry(metric, entryId, dateText, rawValue) {
        if (!dateText) {
          setFormError("请选择日期");
          return;
        }
        if (!isValidDateText(dateText)) {
          setFormError("日期格式无效");
          return;
        }
        if (isFutureDate(dateText)) {
          setFormError("日期不能晚于今天");
          return;
        }

        let parsedValue;
        try {
          parsedValue = parseInputValue(metric, rawValue);
        } catch (error) {
          setFormError(error.message || "录入值不合法");
          return;
        }

        const nextData = cloneData(state.data);
        const currentEntries = getEntries(metric.id, nextData);
        const updatedEntries = currentEntries.map((entry) => {
          if (entry.id !== entryId) return entry;
          return { ...entry, date: dateText, value: parsedValue };
        });

        setEntries(nextData, metric.id, updatedEntries);

        if (metric.id === "dominant_eye") {
          syncDominantEye(nextData);
        }

        if (metric.id === "height" || metric.id === "weight") {
          recalcBmi(nextData);
        }
        reconcileMetricSettings(nextData);

        const saved = await persistData(nextData);
        if (!saved) {
          setFormError(`保存失败：${state.lastPersistError || "未知错误"}`);
          return;
        }

        state.editingEntryId = null;
        state.pendingDeleteId = null;
        setFormError("");
        renderAll();
      }

      async function removeEntry(metric, entryId) {
        const nextData = cloneData(state.data);
        const currentEntries = getEntries(metric.id, nextData);
        const nextEntries = currentEntries.filter((entry) => entry.id !== entryId);
        setEntries(nextData, metric.id, nextEntries);

        if (metric.id === "dominant_eye") {
          syncDominantEye(nextData);
        }

        if (metric.id === "height" || metric.id === "weight") {
          recalcBmi(nextData);
        }
        reconcileMetricSettings(nextData);

        const saved = await persistData(nextData);
        if (!saved) {
          setFormError(`保存失败：${state.lastPersistError || "未知错误"}`);
          return;
        }

        state.pendingDeleteId = null;
        state.editingEntryId = null;
        setFormError("");
        renderAll();
      }

      function updateDataDirButton() {
        if (!elements.dataDirBtn) return;
        elements.dataDirBtn.disabled = !state.openDirSupported;
      }

      async function detectOpenDirCapability() {
        state.openDirSupported = false;
        if (!window.LeeOS || !window.LeeOS.fs) {
          updateDataDirButton();
          return;
        }

        if (typeof window.LeeOS.fs.openDir !== "function") {
          updateDataDirButton();
          return;
        }

        state.openDirSupported = true;
        if (typeof window.LeeOS.fs.capabilities === "function") {
          try {
            const caps = await window.LeeOS.fs.capabilities();
            if (caps && typeof caps.openDir === "boolean") {
              state.openDirSupported = caps.openDir;
            }
          } catch (_error) {
            state.openDirSupported = true;
          }
        }
        updateDataDirButton();
      }

      async function openDataDir() {
        if (!state.openDirSupported || !window.LeeOS || !window.LeeOS.fs || typeof window.LeeOS.fs.openDir !== "function") {
          showMessage("当前环境不支持打开数据文件夹。");
          return;
        }
        try {
          const ok = await window.LeeOS.fs.openDir(".");
          if (!ok) {
            showMessage("打开数据文件夹失败。");
          } else {
            showMessage("");
          }
        } catch (error) {
          showMessage(`打开数据文件夹失败：${(error && error.message) || "未知错误"}`);
        }
      }

      async function handleCreateSubmit() {
        if (state.isSubmitting || state.isBusy) {
          return;
        }

        const metric = state.activeMetricId ? METRIC_MAP.get(state.activeMetricId) : null;
        if (!metric || metric.autoComputed) {
          return;
        }

        const valueControl = elements.entryValueField.querySelector("#entryValue");
        if (!valueControl) {
          return;
        }

        const dateText = elements.entryDate.value;
        if (!dateText) {
          setFormError("请选择日期");
          return;
        }
        if (!isValidDateText(dateText)) {
          setFormError("日期格式无效");
          return;
        }
        if (isFutureDate(dateText)) {
          setFormError("日期不能晚于今天");
          return;
        }

        state.isSubmitting = true;
        try {
          await createEntry(metric, dateText, valueControl.value);
        } catch (error) {
          const message = String((error && error.message) || "Enter value");
          if (message.includes("保存失败") || message.toLowerCase().includes("save failed")) {
            setFormError(message);
            return;
          }
          applyEntryInputHint(metric, message);
        } finally {
          state.isSubmitting = false;
        }
      }

      const createBodyMetricsEventsApi = window.createLeeOSBodyMetricsEventsAPI
      if (!createBodyMetricsEventsApi) {
        throw new Error('Body Metrics events module is not loaded')
      }
      const { attachEvents } = createBodyMetricsEventsApi({
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
      })
      function normalizeLoadedData(raw) {
        if (!raw || typeof raw !== "object") {
          throw new Error("invalid-data");
        }

        if (!raw.metrics || typeof raw.metrics !== "object") {
          throw new Error("invalid-data");
        }

        const normalized = createInitialData();
        normalized.dominantEye = raw.dominantEye === "left" || raw.dominantEye === "right" ? raw.dominantEye : null;
        const rawSettings = raw.metricSettings && typeof raw.metricSettings === "object" ? raw.metricSettings : {};

        FIXED_METRICS.forEach((metric) => {
          const candidate = raw.metrics[metric.id];
          if (!Array.isArray(candidate)) {
            normalized.metrics[metric.id] = [];
            return;
          }

          const cleaned = [];
          candidate.forEach((entry) => {
            if (!entry || typeof entry !== "object") return;
            if (typeof entry.date !== "string") return;
            if (!isValidDateText(entry.date)) return;
            if (isFutureDate(entry.date)) return;
            const normalizedValue = normalizeStoredEntryValue(metric, entry.value);
            if (normalizedValue === null) return;
            const cloned = {
              id: typeof entry.id === "string" ? entry.id : makeId(),
              date: entry.date,
              value: normalizedValue
            };
            cleaned.push(cloned);
          });

          normalized.metrics[metric.id] = sortEntries(cleaned);

          const settingCandidate = rawSettings[metric.id];
          if (!settingCandidate || typeof settingCandidate !== "object") {
            return;
          }
          const cleanedSetting = {};
          const refLow = parseOptionalNumber(settingCandidate.refLow);
          const refHigh = parseOptionalNumber(settingCandidate.refHigh);
          const axisMin = parseOptionalNumber(settingCandidate.axisMin);
          const axisMax = parseOptionalNumber(settingCandidate.axisMax);
          const refState = parseBinaryState(settingCandidate.refState);
          if (refLow !== null) cleanedSetting.refLow = refLow;
          if (refHigh !== null) cleanedSetting.refHigh = refHigh;
          if (axisMin !== null) cleanedSetting.axisMin = axisMin;
          if (axisMax !== null) cleanedSetting.axisMax = axisMax;
          if (metric.type === "binary" && refState !== null) cleanedSetting.refState = refState;
          if (Object.keys(cleanedSetting).length > 0) {
            normalized.metricSettings[metric.id] = cleanedSetting;
          }
        });

        syncDominantEye(normalized);
        recalcBmi(normalized);
        reconcileMetricSettings(normalized);
        return normalized;
      }

      async function loadData() {
        const fsApi = window.LeeOS && window.LeeOS.fs ? window.LeeOS.fs : null;
        const canRead = Boolean(fsApi && (typeof fsApi.readJson === "function" || typeof fsApi.readText === "function"));
        if (!canRead) {
          showMessage("当前环境不可用：未检测到 LeeOS.fs 读写能力。");
          state.openDirSupported = false;
          updateDataDirButton();
          renderAll();
          return;
        }

        await detectOpenDirCapability();

        try {
          const raw = await readStorageJson(DATA_FILE);
          state.data = normalizeLoadedData(raw);
          renderAll();
        } catch (error) {
          if (isMissingFileError(error)) {
            const initial = createInitialData();
            state.data = initial;
            const saved = await persistData(initial);
            if (!saved) {
              showMessage("初始化数据文件失败，请检查写入权限。");
            }
            renderAll();
            return;
          }

          state.lastPersistError = "";
          showMessage("旧数据文件读取失败。你可以直接新增记录，首次保存会重建数据文件。");
          state.data = createInitialData();
          renderAll();
        }
      }

      function bootstrap() {
        buildCategoryList();
        elements.entryDate.value = TODAY_STR;
        elements.entryDate.max = TODAY_STR;
        renderAll();
        attachEvents();
        loadData();
      }

      bootstrap();

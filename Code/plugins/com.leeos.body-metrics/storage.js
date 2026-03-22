;(() => {
  const createLeeOSBodyMetricsStorageAPI = ({
    DATA_FILE,
    state,
    METRIC_MAP,
    updateSaveButton,
  }) => {
      function canPersist() {
        const fsApi = window.LeeOS && window.LeeOS.fs ? window.LeeOS.fs : null;
        const canWrite = Boolean(fsApi && (typeof fsApi.writeText === "function" || typeof fsApi.writeJson === "function"));
        if (!canWrite) {
          state.lastPersistError = "未检测到 LeeOS.fs 写入能力";
          return false;
        }
        state.lastPersistError = "";
        return true;
      }

      function isMissingFileError(error) {
        const text = String((error && error.message) || error || "").toLowerCase();
        return text.includes("enoent") || text.includes("not exist") || text.includes("no such file");
      }

      function withTimeout(promise, ms, message) {
        let timer = null;
        const timeoutPromise = new Promise((_, reject) => {
          timer = window.setTimeout(() => {
            reject(new Error(message));
          }, ms);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => {
          if (timer !== null) {
            window.clearTimeout(timer);
          }
        });
      }

      async function readStorageJson(path) {
        const fsApi = window.LeeOS && window.LeeOS.fs ? window.LeeOS.fs : null;
        if (!fsApi) {
          throw new Error("storage-api-unavailable");
        }
        if (typeof fsApi.readJson === "function") {
          return await fsApi.readJson(path);
        }
        if (typeof fsApi.readText === "function") {
          const text = await fsApi.readText(path);
          if (typeof text !== "string" || !text.trim()) {
            throw new Error("invalid-data");
          }
          return JSON.parse(text);
        }
        throw new Error("storage-api-unavailable");
      }

      async function writeStorageJson(path, value) {
        const fsApi = window.LeeOS && window.LeeOS.fs ? window.LeeOS.fs : null;
        if (!fsApi) {
          throw new Error("storage-api-unavailable");
        }
        if (typeof fsApi.writeText === "function") {
          await fsApi.writeText(path, `${JSON.stringify(value, null, 2)}\n`);
          return;
        }
        if (typeof fsApi.writeJson === "function") {
          await fsApi.writeJson(path, value);
          return;
        }
        throw new Error("storage-api-unavailable");
      }

      function setBusy(flag) {
        state.isBusy = flag;
        const metric = state.activeMetricId ? METRIC_MAP.get(state.activeMetricId) : null;
        if (metric) {
          updateSaveButton(metric);
        }
      }

      async function persistData(nextData) {
        if (!canPersist()) {
          return false;
        }

        setBusy(true);
        try {
          await withTimeout(writeStorageJson(DATA_FILE, nextData), 7000, "写入超时，请重试");
          state.data = nextData;
          state.lastPersistError = "";
          return true;
        } catch (error) {
          state.lastPersistError = (error && error.message) || "未知错误";
          return false;
        } finally {
          setBusy(false);
        }
      }


    return {
      canPersist,
      isMissingFileError,
      withTimeout,
      readStorageJson,
      writeStorageJson,
      setBusy,
      persistData,
    }
  }

  window.createLeeOSBodyMetricsStorageAPI = createLeeOSBodyMetricsStorageAPI
})()

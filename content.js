(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const BTN_ID = "kp-jump-btn";

  function getFilmInfo() {
    const m = location.pathname.match(/^\/(film|series)\/(\d+)/);
    if (!m) return null;
    const type = m[1];
    const kpId = m[2];

    let title = "";
    const h1 = document.querySelector("h1");
    if (h1) title = h1.textContent.trim();
    // Убираем возможный хвост вида "(2019)" или "(сериал, 2019)"
    title = title.replace(/\s*\([^)]*\)\s*$/, "").trim();

    let year = "";
    const ym = document.title.match(/\((?:[^,)]*,\s*)?(\d{4})/);
    if (ym) year = ym[1];

    if (!title) {
      title = document.title.replace(/\s*\(.*$/, "").trim();
    }
    return title ? { title, year, kpId, type } : null;
  }

  // После обновления/перезагрузки расширения старый скрипт на открытой странице
  // «осиротевает»: api.runtime.id пропадает, обращение к storage бросает
  // "Extension context invalidated". Тогда тихо отключаемся.
  function isAlive() {
    try { return !!api?.runtime?.id; } catch { return false; }
  }

  function shutdown() {
    observer.disconnect();
    window.removeEventListener("popstate", schedule);
    document.getElementById(BTN_ID)?.remove();
  }

  async function getSettings() {
    if (!isAlive()) throw new Error("context-invalidated");
    try {
      const stored = await api.storage.sync.get(KPJ_DEFAULTS);
      return { ...KPJ_DEFAULTS, ...stored };
    } catch (e) {
      if (!isAlive()) throw new Error("context-invalidated");
      console.warn("KP Jump: не удалось прочитать настройки, используются значения по умолчанию", e);
      return { ...KPJ_DEFAULTS };
    }
  }

  async function onClick() {
    const info = getFilmInfo();
    if (!info) return;
    let s;
    try { s = await getSettings(); }
    catch { alert("KP Jump: расширение было обновлено. Обновите страницу (F5)."); shutdown(); return; }
    const tpl = kpjResolveTemplate(s);
    if (!tpl) {
      alert("KP Jump: свой шаблон ссылки не задан или некорректен. Откройте настройки расширения.");
      return;
    }
    const data = { ...info };
    if (s.includeYear && info.year) data.title = `${info.title} ${info.year}`;
    const url = kpjBuildUrl(tpl, data);
    if (s.newTab) window.open(url, "_blank", "noopener");
    else location.href = url;
  }

  async function ensureButton() {
    const existing = document.getElementById(BTN_ID);
    if (!getFilmInfo()) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    let s;
    try { s = await getSettings(); } catch { shutdown(); return; }
    if (document.getElementById(BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = s.buttonText || "Смотреть";
    Object.assign(btn.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      zIndex: "2147483647",
      padding: "12px 22px",
      font: "600 15px/1 system-ui, sans-serif",
      color: "#fff",
      background: "#ff5500",
      border: "0",
      borderRadius: "10px",
      boxShadow: "0 4px 14px rgba(0,0,0,.35)",
      cursor: "pointer"
    });
    btn.addEventListener("click", onClick);
    document.documentElement.appendChild(btn);
  }

  // Кинопоиск — SPA/SSR со сменой страниц: следим за DOM и URL, с троттлингом.
  let timer = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; ensureButton().catch(() => {}); }, 300);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener("popstate", schedule);
  ensureButton().catch(() => {});
})();

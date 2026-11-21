(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const BTN_ID = "kp-jump-btn";
  const STYLE_ID = "kp-jump-style";

  const ICON_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M5 4.8v14.4c0 1 .9 1.6 1.8 1.1l12-7.2c.8-.5.8-1.7 0-2.2l-12-7.2C5.9 3.2 5 3.8 5 4.8z" fill="currentColor"/>' +
    '<path d="M14 4h6v6M20 4l-6.5 6.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  function getFilmInfo() {
    const m = location.pathname.match(/^\/(film|series)\/(\d+)/);
    if (!m) return null;
    const type = m[1];
    const kpId = m[2];

    let title = "";
    const h1 = document.querySelector("h1");
    if (h1) title = h1.textContent.trim();
    // Убираем возможный хвост вида "(2019)" или "(сериал 2023 – ...)"
    title = title.replace(/\s*\([^)]*\)\s*$/, "").trim();

    let year = "";
    const ym =
      document.title.match(/\([^)]*?(\d{4})/) ||
      (h1 && h1.textContent.match(/\([^)]*?(\d{4})/));
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
    try { api.storage?.onChanged?.removeListener(onStorageChange); } catch {}
    document.getElementById(BTN_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
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

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-sizing: border-box;
        font: 600 15px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #fff;
        background: linear-gradient(135deg, #ff5500 0%, #ff7a00 100%);
        border: 0;
        border-radius: 52px;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        text-decoration: none;
        user-select: none;
        transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease;
      }
      #${BTN_ID}:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }
      #${BTN_ID}:active {
        transform: translateY(0) scale(0.98);
        filter: brightness(0.97);
      }
      #${BTN_ID}:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      #${BTN_ID}.kp-jump-inline {
        padding: 0 22px;
        height: 48px;
        box-shadow: 0 4px 14px rgba(255, 85, 0, 0.32);
      }
      #${BTN_ID}.kp-jump-inline:hover {
        box-shadow: 0 6px 18px rgba(255, 85, 0, 0.45);
      }
      #${BTN_ID}.kp-jump-floating {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        padding: 13px 22px;
        height: auto;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.16) inset;
      }
      #${BTN_ID}.kp-jump-floating:hover {
        box-shadow: 0 8px 24px rgba(255, 85, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.22) inset;
      }
      #${BTN_ID} svg {
        display: block;
        flex-shrink: 0;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // Ищем панель действий рядом с кнопкой «Буду смотреть» в карточке фильма/сериала
  function findInlineAnchor() {
    const buttons = document.querySelectorAll("button");
    let refBtn = null;
    for (const b of buttons) {
      if (b.id === BTN_ID) continue;
      if (b.closest("header, nav, footer")) continue;
      const text = (b.textContent || "").trim();
      const titleAttr = (b.getAttribute("title") || b.getAttribute("aria-label") || "").trim();
      if (
        /^(Буду смотреть|В папке|В списке|Не буду смотреть)$/i.test(text) ||
        /^Буду смотреть$/i.test(titleAttr)
      ) {
        const rect = b.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          refBtn = b;
          break;
        }
      }
    }
    if (!refBtn) return null;

    // Поднимаемся к ближайшему горизонтальному flex-контейнеру (строка кнопок действий)
    let container = refBtn.parentElement;
    let cur = refBtn.parentElement;
    for (let depth = 0; cur && depth < 4; depth++, cur = cur.parentElement) {
      const cs = getComputedStyle(cur);
      const isRowFlex =
        (cs.display === "flex" || cs.display === "inline-flex") &&
        !cs.flexDirection.startsWith("column");
      if (isRowFlex) {
        container = cur;
        if (cur.children.length >= 2) break;
      }
    }
    if (!container || container === document.body || container === document.documentElement) {
      return null;
    }

    const refHeight = Math.round(refBtn.getBoundingClientRect().height);
    const height = refHeight >= 36 && refHeight <= 60 ? refHeight : 48;
    const cs = getComputedStyle(container);
    const gap = parseFloat(cs.columnGap || cs.gap || "0");
    return { container, height, needsMargin: !(gap > 0) };
  }

  async function openTarget(forceNewTab) {
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
    if (forceNewTab || s.newTab) window.open(url, "_blank", "noopener");
    else location.href = url;
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.innerHTML = `${ICON_SVG}<span class="kp-jump-label"></span>`;
    btn.addEventListener("click", () => openTarget(false));
    btn.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        openTarget(true);
      }
    });
    return btn;
  }

  async function ensureButton() {
    const existing = document.getElementById(BTN_ID);
    if (!getFilmInfo()) {
      if (existing) existing.remove();
      return;
    }
    let s;
    try { s = await getSettings(); } catch { shutdown(); return; }

    ensureStyles();
    const anchor = s.buttonPosition !== "floating" ? findInlineAnchor() : null;
    const targetParent = anchor ? anchor.container : document.documentElement;
    const btn = document.getElementById(BTN_ID) || createButton();

    const labelEl = btn.querySelector(".kp-jump-label");
    const nextText = s.buttonText || KPJ_DEFAULTS.buttonText;
    if (labelEl && labelEl.textContent !== nextText) {
      labelEl.textContent = nextText;
    }
    btn.title = `KP Jump → ${kpjPresetLabel(s)}`;

    if (anchor) {
      btn.className = "kp-jump-inline";
      btn.style.height = `${anchor.height}px`;
      btn.style.marginLeft = anchor.needsMargin ? "10px" : "";
    } else {
      btn.className = "kp-jump-floating";
      btn.style.height = "";
      btn.style.marginLeft = "";
    }

    if (btn.parentElement !== targetParent) {
      targetParent.appendChild(btn);
    }
  }

  // Кинопоиск — SPA/SSR со сменой страниц: следим за DOM и URL, с троттлингом.
  let timer = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; ensureButton().catch(() => {}); }, 300);
  };
  const onStorageChange = (_changes, area) => {
    if (area === "sync") schedule();
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener("popstate", schedule);
  try { api.storage?.onChanged?.addListener(onStorageChange); } catch {}
  ensureButton().catch(() => {});
})();

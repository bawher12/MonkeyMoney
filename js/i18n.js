/**
 * MonkeyMoney i18n engine
 * - Detects browser language on first visit
 * - Lets the user override with the ES/EN toggle
 * - Persists the choice in localStorage
 * - Replaces text on any element with [data-i18n="key"]
 */
(function () {
  const SUPPORTED = ["es", "en"];
  const DEFAULT_LANG = "es";
  const STORAGE_KEY = "mm_lang";

  function detectLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;

    const nav = (navigator.language || navigator.userLanguage || DEFAULT_LANG)
      .slice(0, 2)
      .toLowerCase();
    return SUPPORTED.includes(nav) ? nav : DEFAULT_LANG;
  }

  function localesBasePath() {
    // Works whether the page lives at the site root or one folder deep.
    const path = window.location.pathname;
    const depth = path.split("/").filter(Boolean).length;
    // index.html at root => depth could be 0 or 1 depending on filename presence.
    // We instead rely on a <body data-root="..."> set per page, falling back to "locales/".
    return document.body.getAttribute("data-root") || "";
  }

  async function loadDict(lang) {
    const base = localesBasePath();
    const res = await fetch(`${base}locales/${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo cargar locales/${lang}.json`);
    return res.json();
  }

  function applyDict(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) {
        el.textContent = dict[key];
      }
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      // format: data-i18n-attr="placeholder:key.name"
      const spec = el.getAttribute("data-i18n-attr");
      const [attr, key] = spec.split(":");
      if (dict[key] !== undefined) {
        el.setAttribute(attr, dict[key]);
      }
    });
  }

  function setPressedState(lang) {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.lang === lang ? "true" : "false");
    });
    document.documentElement.setAttribute("lang", lang);
  }

  async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    try {
      const dict = await loadDict(lang);
      window.__mmDict = dict;
      applyDict(dict);
      setPressedState(lang);
      document.dispatchEvent(new CustomEvent("mm:lang-changed", { detail: { lang, dict } }));
    } catch (err) {
      console.error(err);
    }
  }

  function initLangToggle() {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => setLang(btn.dataset.lang));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLangToggle();
    setLang(detectLang());
  });

  // Expose for game/library scripts that need translated strings dynamically.
  window.mmI18n = { setLang, t: (key) => (window.__mmDict || {})[key] || key };
})();

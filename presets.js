// Список поддерживаемых сервисов. Плейсхолдеры в шаблоне:
//   {title}  — название фильма (URL-кодируется)
//   {year}   — год выпуска
//   {kp_id}  — ID с Кинопоиска
//   {type}   — тип страницы: film или series
//   {kp_path} — путь на Кинопоиске: film/123 или series/123
globalThis.KPJ_PRESETS = {
  tmdb: {
    label: "TMDB (поиск)",
    template: "https://www.themoviedb.org/search?query={title}"
  },
  imdb: {
    label: "IMDb (поиск)",
    template: "https://www.imdb.com/find/?q={title}&s=tt"
  },
  letterboxd: {
    label: "Letterboxd (поиск)",
    template: "https://letterboxd.com/search/{title}/"
  },
  justwatch: {
    label: "JustWatch (где посмотреть легально)",
    template: "https://www.justwatch.com/ru/поиск?q={title}"
  }
};

globalThis.KPJ_CUSTOM_KEY = "custom";

globalThis.KPJ_DEFAULTS = {
  preset: "justwatch",
  customTemplate: "",
  includeYear: false,
  newTab: true,
  buttonText: "Смотреть"
};

globalThis.kpjBuildUrl = function (templateStr, data) {
  return templateStr
    .replace(/\{title\}/g, encodeURIComponent(data.title))
    .replace(/\{year\}/g, encodeURIComponent(data.year || ""))
    .replace(/\{kp_id\}/g, encodeURIComponent(data.kpId || ""))
    .replace(/\{type\}/g, encodeURIComponent(data.type || ""))
    .replace(/\{kp_path\}/g, data.type && data.kpId ? `${data.type}/${data.kpId}` : "");
};

// Шаблон должен быть http(s)-ссылкой (защита от javascript: и т.п.)
globalThis.kpjIsValidTemplate = function (t) {
  return /^https?:\/\/\S+$/i.test((t || "").trim());
};

// Возвращает шаблон по настройкам (пользовательский или из списка)
globalThis.kpjResolveTemplate = function (s) {
  if (s.preset === KPJ_CUSTOM_KEY) {
    return kpjIsValidTemplate(s.customTemplate) ? s.customTemplate.trim() : null;
  }
  return (KPJ_PRESETS[s.preset] || KPJ_PRESETS[KPJ_DEFAULTS.preset]).template;
};

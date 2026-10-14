const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

for (const [key, p] of Object.entries(KPJ_PRESETS)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = p.label;
  $("preset").appendChild(o);
}

{
  const o = document.createElement("option");
  o.value = KPJ_CUSTOM_KEY;
  o.textContent = "Свой шаблон…";
  $("preset").appendChild(o);
}

function currentTemplate() {
  return $("preset").value === KPJ_CUSTOM_KEY
    ? $("customTemplate").value.trim()
    : KPJ_PRESETS[$("preset").value].template;
}

function showTemplate() {
  const custom = $("preset").value === KPJ_CUSTOM_KEY;
  $("customBlock").hidden = !custom;
  $("tplLine").hidden = custom;
  if (!custom) $("tpl").textContent = currentTemplate();
  const t = currentTemplate();
  if (custom && t && !kpjIsValidTemplate(t)) {
    $("preview").textContent = "Шаблон должен начинаться с http:// или https://";
    $("preview").className = "err";
  } else if (custom && t) {
    $("preview").textContent = "Пример: " + kpjBuildUrl(t, { title: "Интерстеллар", year: "2014", kpId: "258687" });
    $("preview").className = "";
  } else {
    $("preview").textContent = "";
  }
}
$("preset").addEventListener("change", showTemplate);
$("customTemplate").addEventListener("input", showTemplate);

(async () => {
  const s = { ...KPJ_DEFAULTS, ...(await api.storage.sync.get(KPJ_DEFAULTS)) };
  $("customTemplate").value = s.customTemplate || "";
  $("preset").value = (KPJ_PRESETS[s.preset] || s.preset === KPJ_CUSTOM_KEY) ? s.preset : KPJ_DEFAULTS.preset;
  $("includeYear").checked = s.includeYear;
  $("newTab").checked = s.newTab;
  $("buttonText").value = s.buttonText;
  showTemplate();
})();

$("save").addEventListener("click", async () => {
  if ($("preset").value === KPJ_CUSTOM_KEY && !kpjIsValidTemplate($("customTemplate").value)) {
    $("status").textContent = "Укажите корректный шаблон (http/https)";
    $("status").className = "err";
    return;
  }
  $("status").className = "";
  await api.storage.sync.set({
    preset: $("preset").value,
    customTemplate: $("customTemplate").value.trim(),
    includeYear: $("includeYear").checked,
    newTab: $("newTab").checked,
    buttonText: $("buttonText").value.trim() || KPJ_DEFAULTS.buttonText
  });
  $("status").textContent = "Сохранено";
  setTimeout(() => ($("status").textContent = ""), 1500);
});

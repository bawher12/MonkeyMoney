(function () {
  const listEl = document.getElementById("library-list-grid");
  let catalog = [];

  function currentLang() {
    return document.documentElement.getAttribute("lang") === "en" ? "en" : "es";
  }

  function t(key) {
    return (window.mmI18n && window.mmI18n.t(key)) || key;
  }

function cardHtml(item) {
    const lang = currentLang();
    const title = lang === "en" ? item.title_en : item.title_es;
    const desc = lang === "en" ? item.desc_en : item.desc_es;
    const type = lang === "en" ? item.type_en : item.type;
    const file = (lang === "en" && item.file_en) ? item.file_en : item.file;
    const available = item.status === "disponible" && file;
    const statusLabel = available ? t("library.label.available") : t("library.label.soon");
    const stampClass = available ? "stamp-done" : "stamp-soon";
    const stampText = available ? "OK" : "SOON";

    const action = available
      ? `<a href="reader.html?file=${encodeURIComponent(file)}&title=${encodeURIComponent(title)}" class="btn btn-primary">${t("library.btn.read")}</a>`
      : `<span class="btn btn-secondary">${t("library.btn.soon")}</span>`;
    return `
      <div class="content-card${available ? "" : " disabled"}">
        <div class="content-card-top">
          <div>
            <div class="meta">${statusLabel} · ${type}</div>
            <h3>${title}</h3>
          </div>
          <div class="stamp ${stampClass}">${stampText}</div>
        </div>
        <p>${desc}</p>
        ${action}
      </div>`;
  }

  function render() {
    if (!catalog.length) {
      listEl.innerHTML = `<p style="color:var(--ink-soft)">${t("library.empty")}</p>`;
      return;
    }
    listEl.innerHTML = catalog.map(cardHtml).join("");
  }

  fetch("data/library.json?v=" + Date.now(), { cache: "no-store" })
    .then((res) => res.json())
    .then((data) => {
      catalog = data;
      render();
    })
    .catch((err) => {
      console.error(err);
      listEl.innerHTML = `<p style="color:var(--wax-red)">${t("library.empty")}</p>`;
    });

  document.addEventListener("mm:lang-changed", render);
})();

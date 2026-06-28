(function () {
  const listEl = document.getElementById("games-list");
  let catalog = [];

  function currentLang() {
    return document.documentElement.getAttribute("lang") === "en" ? "en" : "es";
  }

  function t(key) {
    return (window.mmI18n && window.mmI18n.t(key)) || key;
  }

  function cardHtml(game) {
    const lang = currentLang();
    const title = lang === "en" ? game.title_en : game.title_es;
    const desc = lang === "en" ? game.desc_en : game.desc_es;
    const category = lang === "en" ? game.category_en : game.category;
    const available = game.status === "disponible" && game.file;
    const statusLabel = available ? t("games.label.available") : t("games.label.soon");
    const stampClass = available ? "stamp-done" : "stamp-soon";
    const stampText = available ? "OK" : "SOON";

    const action = available
      ? `<a href="game-player.html?file=${encodeURIComponent(game.file)}&title=${encodeURIComponent(title)}" class="btn btn-primary">${t("games.btn.play")}</a>`
      : `<span class="btn btn-secondary">${t("games.btn.soon")}</span>`;

    return `
      <div class="content-card${available ? "" : " disabled"}">
        <div class="content-card-top">
          <div>
            <div class="meta">${statusLabel} · ${category}</div>
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
      listEl.innerHTML = `<p style="color:var(--ink-soft)">${t("games.empty")}</p>`;
      return;
    }
    listEl.innerHTML = catalog.map(cardHtml).join("");
  }

  fetch("data/games.json")
    .then((res) => res.json())
    .then((data) => {
      catalog = data;
      render();
    })
    .catch((err) => {
      console.error(err);
      listEl.innerHTML = `<p style="color:var(--wax-red)">${t("games.empty")}</p>`;
    });

  document.addEventListener("mm:lang-changed", render);
})();

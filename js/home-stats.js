(function () {
  Promise.all([
    fetch("data/games.json").then((r) => r.json()).catch(() => []),
    fetch("data/library.json").then((r) => r.json()).catch(() => []),
  ]).then(([games, books]) => {
    const availableGames = games.filter((g) => g.status === "disponible" && g.file).length;
    const availableBooks = books.filter((b) => b.status === "disponible" && b.file).length;
    const gamesEl = document.getElementById("stat-games");
    const booksEl = document.getElementById("stat-books");
    if (gamesEl) gamesEl.textContent = `${availableGames} / ${games.length}`;
    if (booksEl) booksEl.textContent = `${availableBooks}`;
  });
})();

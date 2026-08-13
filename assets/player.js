/* ============================================================
   MonkeyMoney - Reproductor flotante de música (player.js)
   ============================================================
   Cómo usarlo:
   1. Sube este archivo a tu repo, por ejemplo en /assets/js/player.js
   2. En cada página (home, games, library, community) agrega antes
      de </body>:
        <script src="/assets/js/player.js"></script>
      (ajusta la ruta según donde lo guardes)
   3. Listo. No necesitas tocar nada más — todo el HTML y CSS se
      inyecta automáticamente por JS.
   ============================================================ */

(function () {
  var PLAYLIST_ID = '0x5AMLQvTFnqGsj4e9RlWl';

  var style = document.createElement('style');
  style.textContent = `
    .mm-player {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .mm-player__toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #0a0a0a;
      color: #b6ff3c;
      border: 2px solid #b6ff3c;
      border-radius: 999px;
      padding: 10px 16px;
      font-family: 'Unbounded', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 4px 4px 0 #ff3ccb;
      transition: transform 0.15s ease;
    }
    .mm-player__toggle:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #ff3ccb;
    }
    .mm-player__icon {
      font-size: 16px;
      line-height: 1;
    }
    .mm-player__panel {
      display: none;
      position: absolute;
      bottom: 56px;
      right: 0;
      width: 300px;
      background: #0a0a0a;
      border: 2px solid #b6ff3c;
      border-radius: 16px;
      box-shadow: 6px 6px 0 #ff3ccb;
      overflow: hidden;
    }
    .mm-player__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid #262626;
    }
    .mm-player__title {
      font-family: 'Unbounded', sans-serif;
      font-size: 12px;
      color: #b6ff3c;
      letter-spacing: 0.02em;
    }
    .mm-player__close {
      background: none;
      border: none;
      color: #ff3ccb;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    .mm-player__frame {
      display: block;
      border: none;
    }
    .mm-player--expanded .mm-player__panel {
      display: block;
    }
    .mm-player--expanded .mm-player__toggle {
      display: none;
    }
    @media (max-width: 480px) {
      .mm-player__panel {
        width: calc(100vw - 40px);
      }
    }
  `;
  document.head.appendChild(style);

  var wrapper = document.createElement('div');
  wrapper.id = 'mm-player';
  wrapper.className = 'mm-player mm-player--collapsed';
  wrapper.innerHTML = `
    <button id="mm-player-toggle" class="mm-player__toggle" aria-label="Abrir reproductor de música">
      <span class="mm-player__icon">♪</span>
      <span class="mm-player__label">Música</span>
    </button>
    <div class="mm-player__panel">
      <div class="mm-player__header">
        <span class="mm-player__title">MonkeyMoney Beats</span>
        <button id="mm-player-close" class="mm-player__close" aria-label="Minimizar reproductor">−</button>
      </div>
      <iframe
        id="mm-player-frame"
        class="mm-player__frame"
        src="https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?utm_source=generator&theme=0"
        width="100%"
        height="152"
        frameborder="0"
        allowfullscreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy">
      </iframe>
    </div>
  `;
  document.body.appendChild(wrapper);

  document.getElementById('mm-player-toggle').addEventListener('click', function () {
    wrapper.classList.remove('mm-player--collapsed');
    wrapper.classList.add('mm-player--expanded');
  });

  document.getElementById('mm-player-close').addEventListener('click', function () {
    wrapper.classList.remove('mm-player--expanded');
    wrapper.classList.add('mm-player--collapsed');
  });
})();

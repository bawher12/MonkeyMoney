/* ============================================================
   MonkeyMoney - Widget de chat flotante
   ============================================================ */

(function () {
  var WORKER_URL = 'https://monkeymoney.1144034881.workers.dev';
  var BOT_IMG = 'assets/Botmo.png'; // <-- sube Botmo.png a esta ruta en tu repo

  var history = [];
  var isOpen = false;
  var isSending = false;

  var style = document.createElement('style');
  style.textContent = `
    @keyframes mm-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes mm-glow {
      0%, 100% { box-shadow: 4px 4px 0 #ff3ccb, 0 0 0px rgba(182,255,60,0.0); }
      50% { box-shadow: 4px 4px 0 #ff3ccb, 0 0 18px rgba(182,255,60,0.65); }
    }
    @keyframes mm-blink {
      0%, 96%, 100% { transform: scaleY(0); }
      98% { transform: scaleY(1); }
    }

    .mm-chat-btn {
      position: fixed; bottom: 84px; right: 20px; z-index: 9998;
      width: 56px; height: 56px;
      display: flex; align-items: center; justify-content: center;
      background: #0a0a0a; border: 2px solid #b6ff3c;
      border-radius: 50%; overflow: visible;
      cursor: pointer; transition: transform .12s ease;
      animation: mm-float 3s ease-in-out infinite, mm-glow 3s ease-in-out infinite;
    }
    .mm-chat-btn:hover { transform: translate(-2px,-2px) scale(1.05); }
    .mm-chat-btn-inner {
      position: relative; width: 100%; height: 100%;
      border-radius: 50%; overflow: hidden;
    }
    .mm-chat-btn-inner img {
      width: 100%; height: 100%; object-fit: cover;
    }
    /* "parpados" simulados: dos franjas que bajan sobre los ojos */
    .mm-eyelid {
      position: absolute; left: 22%; width: 24%; height: 14%;
      background: #d9a066; border-radius: 40%;
      transform-origin: top center; transform: scaleY(0);
      animation: mm-blink 5s ease-in-out infinite;
    }
    .mm-eyelid.right { left: 54%; }

    .mm-chat-panel {
      display: none; flex-direction: column;
      position: fixed; bottom: 144px; right: 20px; z-index: 9998;
      width: 320px; max-width: calc(100vw - 40px); height: 420px;
      background: #0a0a0a; border: 2px solid #b6ff3c; border-radius: 18px;
      box-shadow: 6px 6px 0 #ff3ccb; overflow: hidden;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .mm-chat-panel.open { display: flex; }

    .mm-chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-bottom: 1px solid #262626;
    }
    .mm-chat-header .title {
      font-family: 'Unbounded', sans-serif; font-size: 13px; color: #b6ff3c;
      display: flex; align-items: center; gap: 8px;
    }
    .mm-chat-header .title img {
      width: 26px; height: 26px; border-radius: 50%; object-fit: cover;
      animation: mm-float 3s ease-in-out infinite;
    }
    .mm-chat-header .close { background: none; border: none; color: #ff3ccb; font-size: 18px; cursor: pointer; }

    .mm-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .mm-msg { max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
    .mm-msg.bot { align-self: flex-start; background: #1a1a1a; color: #f4f4f0; border: 1px solid #262626; }
    .mm-msg.user { align-self: flex-end; background: #b6ff3c; color: #08130a; font-weight: 500; }
    .mm-msg.typing { align-self: flex-start; color: #9a9a92; font-family: 'Space Mono', monospace; font-size: 11px; }

    .mm-chat-input-row { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #262626; }
    .mm-chat-input-row input {
      flex: 1; background: #131313; border: 1px solid #262626; border-radius: 999px;
      padding: 8px 12px; color: #f4f4f0; font-size: 13px; outline: none;
    }
    .mm-chat-input-row input:focus { border-color: #b6ff3c; }
    .mm-chat-input-row button {
      background: #b6ff3c; border: none; border-radius: 999px; width: 36px; height: 36px;
      color: #08130a; font-weight: 700; cursor: pointer; flex: none;
    }
    .mm-chat-input-row button:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'mm-chat-btn';
  btn.setAttribute('aria-label', 'Preguntar a MonkeyMoney');
  btn.innerHTML = `
    <div class="mm-chat-btn-inner">
      <img src="${BOT_IMG}" alt="Monkey Money">
      <div class="mm-eyelid left"></div>
      <div class="mm-eyelid right"></div>
    </div>
  `;

  var panel = document.createElement('div');
  panel.className = 'mm-chat-panel';
  panel.innerHTML = `
    <div class="mm-chat-header">
      <span class="title"><img src="${BOT_IMG}" alt=""> Monkey Money</span>
      <button class="close" aria-label="Cerrar chat">×</button>
    </div>
    <div class="mm-chat-messages" id="mm-chat-messages"></div>
    <div class="mm-chat-input-row">
      <input type="text" id="mm-chat-input" placeholder="Pregúntame sobre lana..." maxlength="300">
      <button id="mm-chat-send" aria-label="Enviar">➤</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var messagesEl = panel.querySelector('#mm-chat-messages');
  var inputEl = panel.querySelector('#mm-chat-input');
  var sendBtn = panel.querySelector('#mm-chat-send');
  var closeBtn = panel.querySelector('.close');

  function addMessage(role, text) {
    var el = document.createElement('div');
    el.className = 'mm-msg ' + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function showWelcomeIfEmpty() {
    if (history.length === 0) {
      addMessage('bot', '¡Hola! Soy Monkey 🐵 Pregúntame lo que quieras sobre ahorro, tarjetas, presupuesto o cualquier duda financiera.');
    }
  }

  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      showWelcomeIfEmpty();
      inputEl.focus();
    }
  });
  closeBtn.addEventListener('click', function () {
    isOpen = false;
    panel.classList.remove('open');
  });

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isSending) return;

    addMessage('user', text);
    history.push({ role: 'user', text: text });
    inputEl.value = '';
    isSending = true;
    sendBtn.disabled = true;

    var typingEl = document.createElement('div');
    typingEl.className = 'mm-msg typing';
    typingEl.textContent = 'Monkey está escribiendo...';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typingEl.remove();
        var reply = data.reply || 'Se me enredó el mico, ¿me lo repites?';
        addMessage('bot', reply);
        history.push({ role: 'bot', text: reply });
      })
      .catch(function () {
        typingEl.remove();
        addMessage('bot', 'No pude conectarme ahora mismo. ¿Lo intentamos de nuevo en un momento?');
      })
          .finally(function () {
      isSending = false;
      sendBtn.disabled = false;
    });
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();

/* ============================================================
   MonkeyMoney - Widget de chat flotante
   ============================================================
   Cómo usarlo:
   1. Reemplaza WORKER_URL abajo por la URL que te dio Wrangler
      al desplegar el Worker (paso 3 de la guía).
   2. Sube este archivo a /js/chatbot.js
   3. En cada página, antes de </body>:
        <script src="js/chatbot.js"></script>
   ============================================================ */

(function () {
  var WORKER_URL = 'https://1144034881.workers.dev';

  var history = []; // { role: 'user'|'bot', text: '...' }
  var isOpen = false;
  var isSending = false;

  var style = document.createElement('style');
  style.textContent = `
    .mm-chat-btn {
      position: fixed; bottom: 20px; right: 92px; z-index: 9998;
      display: flex; align-items: center; gap: 8px;
      background: #0a0a0a; color: #b6ff3c; border: 2px solid #b6ff3c;
      border-radius: 999px; padding: 10px 16px;
      font-family: 'Unbounded', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; box-shadow: 4px 4px 0 #ff3ccb; transition: transform .12s ease;
    }
    .mm-chat-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 #ff3ccb; }

    .mm-chat-panel {
      display: none; position: fixed; bottom: 78px; right: 20px; z-index: 9998;
      width: 320px; max-width: calc(100vw - 40px); height: 420px;
      background: #0a0a0a; border: 2px solid #b6ff3c; border-radius: 18px;
      box-shadow: 6px 6px 0 #ff3ccb; overflow: hidden;
      display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .mm-chat-panel.open { display: flex; }

    .mm-chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 1px solid #262626;
    }
    .mm-chat-header .title {
      font-family: 'Unbounded', sans-serif; font-size: 13px; color: #b6ff3c;
      display: flex; align-items: center; gap: 6px;
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
  btn.innerHTML = '<span>🐵</span><span>Pregúntame</span>';

  var panel = document.createElement('div');
  panel.className = 'mm-chat-panel';
  panel.innerHTML = `
    <div class="mm-chat-header">
      <span class="title">🐵 MonkeyMoney</span>
      <button class="close" aria-label="Cerrar chat">×</button>
    </div>
    <div class="mm-chat-messages" id="mm-chat-messages"></div>
    <div class="mm-chat-input-row">
      <input type="text" id="mm-chat-input" placeholder="Pregúntame sobre finanzas..." maxlength="300">
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
      addMessage('bot', '¡Hola! Soy el asistente de MonkeyMoney 🐵 Pregúntame lo que quieras sobre ahorro, tarjetas, presupuesto o cualquier duda financiera.');
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
    typingEl.textContent = 'Mono está escribiendo...';
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
        var reply = data.reply || 'Se me enredó el hilo, ¿me lo repites?';
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

/* ============================================================
   MonkeyMoney - Worker de Cloudflare (puente seguro a Gemini)
   ============================================================
   Cómo desplegarlo:
   1. Guarda este archivo como worker.js en una carpeta nueva
      (ej. mm-chatbot-worker/worker.js)
   2. En esa carpeta corre: wrangler deploy
      (te pedirá un nombre para el Worker si es la primera vez;
      wrangler crea el wrangler.toml automáticamente si no existe)
   3. Corre: wrangler secret put GEMINI_API_KEY
      y pega ahí tu API key de Gemini cuando te la pida
      (esto la guarda cifrada, nunca queda en el código)
   4. Wrangler te dará una URL tipo:
      https://mm-chatbot-worker.tu-usuario.workers.dev
      Esa es la URL que va en chatbot.js (WORKER_URL)
   ============================================================ */

// Contexto del catálogo de MonkeyMoney para que el bot pueda
// recomendar contenido real del sitio cuando aplique.
const CATALOGO = `
JUEGOS DISPONIBLES EN EL SITIO:
- Presupuesto Express: reparte un ingreso mensual entre gastos, ahorro y deuda.
- La Trampa del Interés: simula 12 meses con una tarjeta de crédito, atrapando gastos y decidiendo cuánto pagar cada mes.
- Monkey Play y Monkey Duel: juegos de cartas/estrategia con temas financieros.
- Flujo de Caja (próximamente): administra el efectivo de un negocio pequeño.
- Riesgo y Paciencia (próximamente): construye un portafolio de inversión simulado.

LIBROS DISPONIBLES EN LA BIBLIOTECA:
- "El Mono que Ahorra": sobre el poder del interés compuesto, narrado por Momo.
- "El Sistema del Mono": libro base de la colección.
- "Printing Monkey": sobre cómo se crea el dinero y por qué no siempre genera inflación.
`;

const SYSTEM_PROMPT = `Eres el asistente de MonkeyMoney, una plataforma de educación financiera para jóvenes.

TU PERSONALIDAD:
- Hablas como un amigo mayor que sabe de finanzas, no como un profesor aburrido ni como un banco.
- Tono natural, cercano y con energía — usas español latino casual, sin sonar forzado ni usar jerga que no encaje.
- Explicas conceptos financieros con ejemplos cotidianos y comparaciones simples, nunca con jerga técnica sin explicarla.
- Eres honesto: si algo es riesgoso o complicado, lo dices claro, sin asustar mas sin suavizar de más.
- Respuestas cortas y conversacionales — como un chat, no como un ensayo. Usa párrafos cortos.

TU ALCANCE:
- Respondes preguntas de finanzas personales: ahorro, presupuesto, deudas, tarjetas de crédito, interés, inversión básica, hábitos de dinero.
- Cuando la pregunta del usuario se relacione con un juego o libro del catálogo de MonkeyMoney, recomiéndalo de forma natural (no forzada) como parte de tu respuesta.
- Si te preguntan algo fuera de finanzas o del sitio, redirige con amabilidad hacia temas financieros.
- Nunca dês consejos de inversión específicos (qué comprar, cuánto invertir) ni asesoría legal o fiscal personalizada — para eso, sugiere hablar con un profesional.

${CATALOGO}

Responde siempre en español, de forma breve y natural, como si estuvieras chateando.`;

export default {
  async fetch(request, env) {
    // CORS: permite que el sitio llame a este Worker desde el navegador
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Método no permitido', { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const userMessage = (body.message || '').slice(0, 800); // límite básico anti-abuso
      const history = Array.isArray(body.history) ? body.history.slice(-10) : []; // últimos 10 turnos

      if (!userMessage.trim()) {
        return new Response(JSON.stringify({ error: 'Mensaje vacío' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contents = [];
      history.forEach(function (turn) {
        contents.push({ role: turn.role === 'bot' ? 'model' : 'user', parts: [{ text: turn.text }] });
      });
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const geminiResp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + env.GEMINI_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: contents,
            generationConfig: { temperature: 0.8, maxOutputTokens: 400 }
          })
        }
      );

      if (!geminiResp.ok) {
        const errText = await geminiResp.text();
        return new Response(JSON.stringify({ error: 'Error de Gemini', detail: errText }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await geminiResp.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
        || 'No pude pensar en una respuesta, ¿me lo preguntas de otra forma?';

      return new Response(JSON.stringify({ reply: reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Error interno', detail: String(err) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

const $ = id => document.getElementById(id);
const n = id => parseFloat($(id)?.value) || 0;
let activeType = 'acciones';
let currentCurrency = localStorage.getItem('mm_currency') || 'COP';
const currencyFmt = new Intl.NumberFormat('es-CO');

// --- i18n helper -----------------------------------------------------
// Looks up a key in the shared site dictionary (loaded by js/i18n.js).
// Falls back to the given Spanish text if the dictionary hasn't loaded
// yet or doesn't have the key, so the page always renders something sane.
function T(key, fallback) {
  const dict = window.__mmDict;
  if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  return fallback;
}

const TYPE = {
  acciones:{title:T('analyzer.type.acciones.title','Acciones'),icon:'📈',subtitle:T('analyzer.type.acciones.subtitle','Analiza una empresa y sus indicadores de valoración, rentabilidad y crecimiento.')},
  inmuebles:{title:T('analyzer.type.inmuebles.title','Inmuebles'),icon:'🏠',subtitle:T('analyzer.type.inmuebles.subtitle','Estudia precio, renta, gastos, ocupación, valorización y rendimiento del inmueble.')},
  cdt:{title:T('analyzer.type.cdt.title','CDT / Renta fija'),icon:'🏦',subtitle:T('analyzer.type.cdt.subtitle','Calcula rendimiento de un CDT o instrumento de renta fija considerando plazo y tasa.')},
  etf:{title:T('analyzer.type.etf.title','ETF / Fondos'),icon:'📊',subtitle:T('analyzer.type.etf.subtitle','Analiza costos, dividendos, crecimiento esperado y rendimiento de un ETF o fondo.')},
  cripto:{title:T('analyzer.type.cripto.title','Criptomonedas'),icon:'🪙',subtitle:T('analyzer.type.cripto.subtitle','Analiza precio, volatilidad, staking y crecimiento esperado de una criptomoneda.')},
  negocios:{title:T('analyzer.type.negocios.title','Negocios / Proyectos'),icon:'💼',subtitle:T('analyzer.type.negocios.subtitle','Evalúa retorno, margen, crecimiento, recuperación de la inversión y riesgo del proyecto.')},
  otra:{title:T('analyzer.type.otra.title','Otra inversión'),icon:'🧩',subtitle:T('analyzer.type.otra.subtitle',"Usa un modelo general para estudiar inversiones que no encajan en las categorías anteriores.")}
};

function money(v){
  const s = currencyFmt.format(Math.round(v));
  const sym = {COP:'$ ',USD:'US$ ',EUR:'€ '}[currentCurrency] || '$ ';
  return sym+s;
}
function pct(v,dec=1){return (v*100).toFixed(dec).replace('.',',')+'%'}
function kindData(kind){return {
  good:{label:T('analyzer.kind.good','BUENA'),img:'good.png',central:'central_good.png',pill:'verdict-good'},
  neutral:{label:T('analyzer.kind.neutral','REGULAR'),img:'neutral.png',central:'neutral.png',pill:'verdict-neutral'},
  bad:{label:T('analyzer.kind.bad','MALA'),img:'bad.png',central:'bad.png',pill:'verdict-bad'}
}[kind]}
function setEval(elId,kind,label){const d=kindData(kind);const el=$(elId);if(!el)return;el.innerHTML=`<span class="eval ${kind==='neutral'?'reg':kind}"><img src="assets/${d.img}">${label}</span>`}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function classify(points){const score=points.reduce((a,b)=>a+b,0), max=points.length; const ratio=score/max; return {score,max,kind:ratio>=.67?'good':ratio>=.42?'neutral':'bad'};}
function EVAL_FAV(){return T('analyzer.eval.favorable','Favorable')}
function EVAL_NEU(){return T('analyzer.eval.neutral','Neutral')}
function EVAL_UNFAV(){return T('analyzer.eval.unfavorable','Desfavorable')}
function EVAL_LOW(){return T('analyzer.eval.low','Baja')}
function EVAL_LONG(){return T('analyzer.eval.long','Largo')}

// --- Buscar dato con el chatbot ------------------------------------------
// Solo para campos que representan un dato de mercado real y consultable
// (precio, dividendo, EPS, valor en libros de acciones/ETF; tasa de un CDT).
// Cosas como "cuántos años te vas a quedar" son decisiones del usuario, no
// datos que se puedan buscar, así que esos campos no tienen este botón.
const LOOKUP_WORKER_URL='https://monkeymoney.1144034881.workers.dev';
const LOOKUP_QUERIES={
  acciones:{
    price:name=>`¿Cuál es el precio actual por acción de ${name} en bolsa? Responde ÚNICAMENTE con el número en pesos colombianos, sin texto adicional, sin símbolo de moneda ni separador de miles, usando punto como separador decimal.`,
    dividend:name=>`¿Cuál es el dividendo anual por acción más reciente de ${name}? Responde ÚNICAMENTE con el número, sin texto adicional, sin símbolo de moneda ni separador de miles, usando punto como separador decimal. Si no reparte dividendos, responde 0.`,
    eps:name=>`¿Cuál es la utilidad por acción (EPS) más reciente de ${name}? Responde ÚNICAMENTE con el número, sin texto adicional, sin símbolo de moneda ni separador de miles, usando punto como separador decimal.`,
    book:name=>`¿Cuál es el valor en libros (book value) por acción más reciente de ${name}? Responde ÚNICAMENTE con el número, sin texto adicional, sin símbolo de moneda ni separador de miles, usando punto como separador decimal.`
  },
  etf:{
    price:name=>`¿Cuál es el precio actual por participación del ETF o fondo ${name}? Responde ÚNICAMENTE con el número, sin texto adicional, sin símbolo de moneda ni separador de miles, usando punto como separador decimal.`,
    dividend:name=>`¿Cuál es la distribución o dividendo anual por participación más reciente del ETF o fondo ${name}? Responde ÚNICAMENTE con el número, sin texto adicional. Si no reparte, responde 0.`
  },
  cdt:{
    growth:name=>`¿Qué tasa efectiva anual (%) ofrecen actualmente los bancos en Colombia para un ${name}? Responde ÚNICAMENTE con el número del porcentaje, sin el símbolo %, sin texto adicional.`
  },
  cripto:{
    price:name=>`¿Cuál es el precio actual de 1 unidad de la criptomoneda ${name} en pesos colombianos? Responde ÚNICAMENTE con el número en pesos colombianos, sin texto adicional, sin símbolo de moneda ni separador de miles, usando punto como separador decimal.`
  }
};
function parseLookupNumber(text){
  if(!text)return null;
  const m=text.trim().match(/-?\d[\d.,]*/);
  if(!m)return null;
  let raw=m[0];
  const hasDot=raw.includes('.'),hasComma=raw.includes(',');
  if(hasDot&&hasComma){
    raw=raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
  }else if(hasComma&&!hasDot){
    const parts=raw.split(',');
    raw=(parts.length===2&&parts[1].length<=2)?raw.replace(',','.'):raw.replace(/,/g,'');
  }
  const num=parseFloat(raw);
  return isNaN(num)?null:num;
}
function showLookupPopover(btn,id,num,rawReply,failed){
  document.querySelectorAll('.lookup-popover').forEach(p=>p.remove());
  const wrap=btn.closest('.field-with-lookup');
  if(!wrap)return;
  const pop=document.createElement('div');
  pop.className='lookup-popover';
  if(failed){
    pop.innerHTML=`<p>${T('analyzer.lookup.error','No pudimos buscar este dato ahora mismo. Intenta de nuevo en un momento.')}</p><div class="lookup-actions"><button type="button" class="lookup-cancel">${T('analyzer.lookup.dismiss','Cerrar')}</button></div>`;
  }else if(num!==null){
    pop.innerHTML=`<p>${T('analyzer.lookup.found','Encontramos:')} <b>${num}</b></p><div class="lookup-actions"><button type="button" class="lookup-use">${T('analyzer.lookup.use','Usar este valor')}</button><button type="button" class="lookup-cancel">${T('analyzer.lookup.dismiss','Cerrar')}</button></div>`;
    pop.querySelector('.lookup-use').addEventListener('click',()=>{$(id).value=num;calc();pop.remove()});
  }else{
    const safeReply=(rawReply||'').slice(0,220).replace(/</g,'&lt;');
    pop.innerHTML=`<p>${T('analyzer.lookup.unclear','El chatbot respondió, pero no pudimos leer un número claro:')} "${safeReply}"</p><div class="lookup-actions"><button type="button" class="lookup-cancel">${T('analyzer.lookup.dismiss','Cerrar')}</button></div>`;
  }
  pop.querySelector('.lookup-cancel').addEventListener('click',()=>pop.remove());
  wrap.insertAdjacentElement('afterend',pop);
}
async function handleLookup(btn){
  const id=btn.dataset.lookupId;
  const type=activeType;
  const queries=LOOKUP_QUERIES[type];
  if(!queries||!queries[id])return;
  const name=$('name')?$('name').value.trim():'';
  if(!name){alert(T('analyzer.lookup.needName','Primero escribe el nombre en el campo de arriba.'));return}
  document.querySelectorAll('.lookup-popover').forEach(p=>p.remove());
  if(btn.classList.contains('loading'))return;
  btn.classList.add('loading');
  const original=btn.textContent;
  btn.textContent='⏳';
  try{
    const resp=await fetch(LOOKUP_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:queries[id](name),history:[]})});
    const data=await resp.json();
    const reply=data&&data.reply?data.reply:'';
    showLookupPopover(btn,id,parseLookupNumber(reply),reply,false);
  }catch(e){
    showLookupPopover(btn,id,null,null,true);
  }finally{
    btn.classList.remove('loading');
    btn.textContent=original;
  }
}

function setAnalysisForm(type){
  activeType=type;
  const c=TYPE[type];
  $('analysisTitle').textContent=c.title; $('analysisIcon').textContent=c.icon; $('analysisSubtitle').textContent=c.subtitle;
  const g=$('analysisFormGrid');
  const simple=getMode()==='simple';
  const L=(key,fallback)=>simple?T(key+'.simple',fallback):T(key,fallback);
  const templates={
    acciones:[
      [L('analyzer.field.acciones.name','¿Qué acción es?'),'text','name',T('analyzer.default.acciones.name','Ecopetrol (ECOPETROL)')],[L('analyzer.field.acciones.price','¿Cuánto cuesta hoy una acción?'),'number','price','1950',true],[L('analyzer.field.acciones.shares','¿Cuántas acciones vas a comprar?'),'number','shares','1000'],[L('analyzer.field.acciones.dividend','¿Cuánto te paga al año por cada acción?'),'number','dividend','120',true],[L('analyzer.field.acciones.divGrowth','¿Ese pago crece cada año? ¿Cuánto (%)?'),'number','divGrowth','5'],[L('analyzer.field.acciones.growth','¿Cuánto crees que va a crecer la empresa al año (%)?'),'number','growth','8'],[L('analyzer.field.acciones.eps','¿Cuánto gana la empresa por cada acción al año?'),'number','eps','240',true],[L('analyzer.field.acciones.book','Si la empresa cerrara hoy, ¿cuánto valdría cada acción en papel?'),'number','book','1000',true],[L('analyzer.field.acciones.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','10'],[L('analyzer.field.acciones.horizon','¿Por cuántos años piensas quedarte con esta inversión?'),'number','horizon','5']
    ],
    inmuebles:[
      [L('analyzer.field.inmuebles.name','¿Qué inmueble es?'),'text','name',T('analyzer.default.inmuebles.name','Apartamento / Local')],[L('analyzer.field.inmuebles.price','¿Cuánto cuesta comprarlo?'),'number','price','300000000'],[L('analyzer.field.inmuebles.shares','¿Cuántos inmuebles como este vas a comprar?'),'number','shares','1'],[L('analyzer.field.inmuebles.dividend','¿Cuánto arriendo recibirías al mes?'),'number','dividend','1800000'],[L('analyzer.field.inmuebles.divGrowth','¿Ese arriendo sube cada año? ¿Cuánto (%)?'),'number','divGrowth','4'],[L('analyzer.field.inmuebles.growth','¿Cuánto crees que va a subir de valor al año (%)?'),'number','growth','6'],[L('analyzer.field.inmuebles.expenses','¿Cuánto gastas al mes en mantenerlo?'),'number','expenses','350000'],[L('analyzer.field.inmuebles.occupancy','¿Qué tanto del tiempo esperas tenerlo arrendado (%)?'),'number','occupancy','95'],[L('analyzer.field.inmuebles.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','10'],[L('analyzer.field.inmuebles.horizon','¿Por cuántos años piensas quedarte con él?'),'number','horizon','10']
    ],
    cdt:[
      [L('analyzer.field.cdt.name','¿Qué CDT o producto es?'),'text','name',T('analyzer.default.cdt.name','CDT a 1 año')],[L('analyzer.field.cdt.price','¿Cuánto vas a poner inicialmente?'),'number','price','10000000'],[L('analyzer.field.cdt.shares','¿Cuántos CDT o cuentas como este vas a abrir?'),'number','shares','1'],[L('analyzer.field.cdt.growth','¿Qué tasa de interés te ofrecen al año (%)?'),'number','growth','9',true],[L('analyzer.field.cdt.horizon','¿A cuántos años es el plazo?'),'number','horizon','1'],[L('analyzer.field.cdt.inflation','¿Cuánto crees que va a subir el costo de vida al año (%)?'),'number','inflation','5'],[L('analyzer.field.cdt.tax','¿Cuánto te descuentan de impuestos sobre lo que ganas (%)?'),'number','tax','4'],[L('analyzer.field.cdt.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','8']
    ],
    etf:[
      [L('analyzer.field.etf.name','¿Qué ETF o fondo es?'),'text','name',T('analyzer.default.etf.name','ETF global')],[L('analyzer.field.etf.price','¿Cuánto cuesta hoy una participación?'),'number','price','400',true],[L('analyzer.field.etf.shares','¿Cuántas participaciones vas a comprar?'),'number','shares','25'],[L('analyzer.field.etf.dividend','¿Cuánto te paga al año por cada participación?'),'number','dividend','6',true],[L('analyzer.field.etf.growth','¿Cuánto crees que va a crecer al año (%)?'),'number','growth','7'],[L('analyzer.field.etf.divGrowth','¿Ese pago crece cada año? ¿Cuánto (%)?'),'number','divGrowth','4'],[L('analyzer.field.etf.expensesRate','¿Cuánto te cobra el fondo al año por administrarlo (%)?'),'number','expensesRate','0.2'],[L('analyzer.field.etf.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','9'],[L('analyzer.field.etf.horizon','¿Por cuántos años piensas quedarte con esto?'),'number','horizon','5']
    ],
    cripto:[
      [L('analyzer.field.cripto.name','¿Qué criptomoneda es?'),'text','name',T('analyzer.default.cripto.name','Bitcoin (BTC)')],[L('analyzer.field.cripto.price','¿Cuánto cuesta hoy 1 unidad?'),'number','price','420000000',true],[L('analyzer.field.cripto.shares','¿Cuántas unidades (o fracciones) vas a comprar?'),'number','shares','0.05'],[L('analyzer.field.cripto.growth','¿Cuánto crees que va a subir de precio al año (%)?'),'number','growth','15'],[L('analyzer.field.cripto.staking','¿Ofrece staking o recompensas? ¿Cuánto al año (%)?'),'number','staking','0'],[L('analyzer.field.cripto.volatility','¿Qué tan volátil crees que es, de 1 (poco) a 10 (mucho)?'),'number','volatility','7'],[L('analyzer.field.cripto.fees','¿Cuánto te cobra el exchange o wallet al año en comisiones (%)?'),'number','fees','0.5'],[L('analyzer.field.cripto.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','15'],[L('analyzer.field.cripto.horizon','¿Por cuántos años piensas quedarte con esta inversión?'),'number','horizon','4']
    ],
    negocios:[
      [L('analyzer.field.negocios.name','¿Qué negocio o proyecto es?'),'text','name',T('analyzer.default.negocios.name','Negocio / Proyecto')],[L('analyzer.field.negocios.price','¿Cuánto necesitas invertir para empezar?'),'number','price','50000000'],[L('analyzer.field.negocios.shares','¿Cuántos negocios o proyectos como este vas a hacer?'),'number','shares','1'],[L('analyzer.field.negocios.revenue','¿Cuánto esperas vender al año?'),'number','revenue','30000000'],[L('analyzer.field.negocios.margin','De lo que vendes, ¿qué porcentaje te queda limpio (%)?'),'number','margin','20'],[L('analyzer.field.negocios.growth','¿Cuánto crees que va a crecer al año (%)?'),'number','growth','8'],[L('analyzer.field.negocios.expenses','¿Cuánto gastas al año en mantenerlo?'),'number','expenses','3000000'],[L('analyzer.field.negocios.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','12'],[L('analyzer.field.negocios.horizon','¿En cuántos años esperas ver resultados?'),'number','horizon','5']
    ],
    otra:[
      [L('analyzer.field.otra.name','¿Qué inversión es?'),'text','name',T('analyzer.default.otra.name','Mi inversión')],[L('analyzer.field.otra.price','¿Cuánto vas a poner inicialmente?'),'number','price','10000000'],[L('analyzer.field.otra.shares','¿Cuántas unidades vas a comprar?'),'number','shares','1'],[L('analyzer.field.otra.dividend','¿Cuánto te genera al año?'),'number','dividend','800000'],[L('analyzer.field.otra.growth','¿Cuánto crees que va a crecer al año (%)?'),'number','growth','7'],[L('analyzer.field.otra.divGrowth','¿Ese ingreso crece cada año? ¿Cuánto (%)?'),'number','divGrowth','3'],[L('analyzer.field.otra.expenses','¿Cuánto gastas al año en mantenerlo?'),'number','expenses','100000'],[L('analyzer.field.otra.discount','¿Qué tanto esperas ganar al año, como mínimo (%)?'),'number','discount','10'],[L('analyzer.field.otra.horizon','¿Por cuántos años piensas quedarte con esto?'),'number','horizon','5']
    ]
  };
  const rows=templates[type];
  g.innerHTML=rows.map(r=>{
    const [label,kind,id,val,lookup]=r;
    const cls=kind==='number'?'number-input':'';
    const hint=id==='discount'?`<small class="field-hint" style="grid-column:1/-1">${T('analyzer.field.discountHint','¿No sabes qué poner? Usa 8-12% como referencia.')}</small>`:'';
    const lookupBtn=lookup?`<button type="button" class="field-lookup-btn" data-lookup-id="${id}" title="${T('analyzer.lookup.tooltip','Preguntarle al chatbot')}">🔍</button>`:'';
    const wrapClass=lookup?'field-with-lookup':'';
    return `<label>${label}</label><div class="${wrapClass}"><input class="${cls}" id="${id}" type="${kind}" value="${val}" step="any">${lookupBtn}</div>${hint}`;
  }).join('');
  const formIds=rows.map(r=>r[2]);
  formIds.forEach(id=>$(id)?.addEventListener('input',calc));
  updateMeaning(type);
  const metricNames={
    acciones:[T('analyzer.metric.acciones.0','PER <small>(Price to Earnings)</small>'),T('analyzer.metric.acciones.1','ROE <small>(Return on Equity)</small>'),T('analyzer.metric.acciones.2','P/B <small>(Price to Book)</small>'),T('analyzer.metric.acciones.3','Dividend Yield'),T('analyzer.metric.acciones.4','CAGR <small>(Crecimiento anual)</small>'),T('analyzer.metric.acciones.5','Margen de seguridad')],
    inmuebles:[T('analyzer.metric.inmuebles.0','Rendimiento bruto'),T('analyzer.metric.inmuebles.1','Rendimiento neto'),T('analyzer.metric.inmuebles.2','Valorización anual'),T('analyzer.metric.inmuebles.3','Ocupación'),T('analyzer.metric.inmuebles.4','Apalancamiento'),T('analyzer.metric.inmuebles.5','Recuperación')],
    cdt:[T('analyzer.metric.cdt.0','Tasa efectiva anual'),T('analyzer.metric.cdt.1','Rendimiento neto'),T('analyzer.metric.cdt.2','Rendimiento real'),T('analyzer.metric.cdt.3','Plazo'),T('analyzer.metric.cdt.4','Retención / impuestos'),T('analyzer.metric.cdt.5','Apalancamiento')],
    etf:[T('analyzer.metric.etf.0','Crecimiento neto'),T('analyzer.metric.etf.1','Dividend Yield'),T('analyzer.metric.etf.2','TER <small>(costo del fondo)</small>'),T('analyzer.metric.etf.3','Eficiencia de costos'),T('analyzer.metric.etf.4','Apalancamiento'),T('analyzer.metric.etf.5','Participaciones')],
    cripto:[T('analyzer.metric.cripto.0','Crecimiento neto'),T('analyzer.metric.cripto.1','Staking / Recompensas'),T('analyzer.metric.cripto.2','Volatilidad'),T('analyzer.metric.cripto.3','Comisiones'),T('analyzer.metric.cripto.4','Apalancamiento'),T('analyzer.metric.cripto.5','Colchón sobre tu mínimo')],
    negocios:[T('analyzer.metric.negocios.0','ROI'),T('analyzer.metric.negocios.1','Margen neto'),T('analyzer.metric.negocios.2','Crecimiento'),T('analyzer.metric.negocios.3','Apalancamiento'),T('analyzer.metric.negocios.4','Recuperación'),T('analyzer.metric.negocios.5','Margen real')],
    otra:[T('analyzer.metric.otra.0','Rendimiento directo'),T('analyzer.metric.otra.1','Crecimiento'),T('analyzer.metric.otra.2','Apalancamiento'),T('analyzer.metric.otra.3','Ingreso neto'),T('analyzer.metric.otra.4','Eficiencia'),T('analyzer.metric.otra.5','Datos completos')]
  }[type];
  metricNames.forEach((v,i)=>{if($(`metricName${i}`)) $(`metricName${i}`).innerHTML=v;});
  calc();
}
function updateMeaning(type){
  const texts={
    acciones:[T('analyzer.meaning.acciones.0','<b>EPS:</b> ganancia por acción.'),T('analyzer.meaning.acciones.1','<b>PER:</b> relación entre precio y ganancias.'),T('analyzer.meaning.acciones.2','<b>ROE:</b> rentabilidad sobre el patrimonio.'),T('analyzer.meaning.acciones.3','<b>P/B:</b> precio frente a valor en libros.'),T('analyzer.meaning.acciones.4','<b>Dividend Yield:</b> rendimiento del dividendo.')],
    inmuebles:[T('analyzer.meaning.inmuebles.0','<b>Rendimiento bruto:</b> arriendo anual frente al precio.'),T('analyzer.meaning.inmuebles.1','<b>Rendimiento neto:</b> descuenta gastos y vacancia.'),T('analyzer.meaning.inmuebles.2','<b>Valorización:</b> crecimiento esperado del valor del inmueble.'),T('analyzer.meaning.inmuebles.3','<b>Ocupación:</b> porcentaje de tiempo con ingreso de renta.')],
    cdt:[T('analyzer.meaning.cdt.0','<b>TEA:</b> tasa efectiva anual ofrecida.'),T('analyzer.meaning.cdt.1','<b>Inflación:</b> pérdida esperada de poder adquisitivo.'),T('analyzer.meaning.cdt.2','<b>Retención:</b> impuesto o retención aplicada al rendimiento.'),T('analyzer.meaning.cdt.3','<b>Rendimiento real:</b> retorno después de inflación.')],
    etf:[T('analyzer.meaning.etf.0','<b>TER:</b> costo anual del fondo.'),T('analyzer.meaning.etf.1','<b>Dividend Yield:</b> ingreso distribuido frente al precio.'),T('analyzer.meaning.etf.2','<b>Crecimiento:</b> apreciación esperada del fondo.'),T('analyzer.meaning.etf.3','<b>Diversificación:</b> distribuir exposición entre múltiples activos.')],
    cripto:[T('analyzer.meaning.cripto.0','<b>Volatilidad:</b> qué tanto sube y baja el precio en el corto plazo.'),T('analyzer.meaning.cripto.1','<b>Staking:</b> recompensa por mantener o bloquear tus monedas.'),T('analyzer.meaning.cripto.2','<b>Comisiones:</b> lo que cobra el exchange o wallet por custodiar o mover tus monedas.'),T('analyzer.meaning.cripto.3','<b>Colchón:</b> qué tanto margen tienes frente al mínimo que esperas ganar.')],
    negocios:[T('analyzer.meaning.negocios.0','<b>Margen neto:</b> utilidad después de costos y gastos.'),T('analyzer.meaning.negocios.1','<b>Flujo de caja:</b> efectivo disponible del proyecto.'),T('analyzer.meaning.negocios.2','<b>ROI:</b> retorno sobre el capital invertido.'),T('analyzer.meaning.negocios.3','<b>Recuperación:</b> tiempo para recuperar el capital.')],
    otra:[T('analyzer.meaning.otra.0','<b>Ingreso anual:</b> dinero generado por el activo.'),T('analyzer.meaning.otra.1','<b>Costos:</b> egresos necesarios para mantenerlo.'),T('analyzer.meaning.otra.2','<b>Rentabilidad:</b> retorno respecto al capital.'),T('analyzer.meaning.otra.3','<b>Tasa de descuento:</b> rendimiento mínimo exigido.')]
  };
  $('meaningList').innerHTML=(texts[type]||texts.otra).map(x=>`<li>${x}</li>`).join('');
}

let _lastVerdictKind=null;
function renderState(kind){const d=kindData(kind);const card=$('verdictCard'),pill=$('verdict'),why=$('whyCard');card.classList.remove('state-good','state-neutral','state-bad');card.classList.add('state-'+kind);pill.className='verdict-pill '+d.pill;why.classList.remove('state-good','state-neutral','state-bad');why.classList.add('state-'+kind);$('verdictImg').src=`assets/${d.central}`;$('whyImg').src=`assets/${d.img}`;$('verdict').textContent=d.label;$('whyLabel').textContent=d.label;
  if(kind!==_lastVerdictKind){
    _lastVerdictKind=kind;
    const img=$('verdictImg');
    img.classList.remove('react-good','react-neutral','react-bad');
    void img.offsetWidth; // reinicia la animación aunque sea la misma clase que antes
    img.classList.add('react-'+kind);
    img.addEventListener('animationend',()=>img.classList.remove('react-'+kind),{once:true});
  }
  return d}

// --- Loan / leverage --------------------------------------------------
// Reads the "¿Vas a pedir un préstamo?" card. Used by every calc*()
// function so debt financing actually affects the result instead of
// being purely decorative.
function getLoanInfo(initial,horizon){
  const active = $('loanYes') && $('loanYes').classList.contains('active') && n('loanAmount')>0;
  if(!active) return {active:false,amount:0,rate:0,interest:0};
  const amount = Math.max(0,n('loanAmount'));
  const rate = n('loanRate')/100;
  const term = Math.min(horizon, n('loanYears')||horizon);
  const interest = amount*rate*term;
  return {active:true,amount,rate,interest,term};
}
// Compares the investment's own expected annual return to the loan's
// interest rate: positive spread = the investment earns more than the
// debt costs (favorable leverage); negative = you're paying more
// interest than you're earning (a real red flag, not shown before).
function loanSpreadMetric(expectedReturn,loan){
  if(!loan.active) return {value:'—',kind:'good',label:T('analyzer.pill.loan.none','Sin apalancamiento')};
  const spread=expectedReturn-loan.rate;
  const kind=spread>.02?'good':spread>=0?'neutral':'bad';
  const label=kind==='good'?EVAL_FAV():kind==='neutral'?EVAL_NEU():EVAL_UNFAV();
  return {value:pct(spread),kind,label};
}
function loanReason(expectedReturn,loan){
  if(!loan.active) return null;
  const spread=expectedReturn-loan.rate;
  return spread>=0
    ? T('analyzer.reason.loan.positive','La rentabilidad esperada ({v}) supera la tasa del préstamo, así que la deuda juega a tu favor.').replace('{v}',pct(expectedReturn))
    : T('analyzer.reason.loan.negative','Estás pagando más interés del que la inversión rendiría ({v} esperado vs. {r} del préstamo); revisa el préstamo antes de continuar.').replace('{v}',pct(expectedReturn)).replace('{r}',pct(loan.rate));
}
// Ties a threshold to the user's own required return (discount rate)
// instead of a fixed number, so "buena/regular/mala" reflects what
// the investor actually needs, not an arbitrary constant.
function relDisc(value,disc,goodMult,neutralMult){
  return value>disc*goodMult?'good':value>disc*neutralMult?'neutral':'bad';
}

function calc(){
  if(activeType==='acciones') return calcAcciones();
  if(activeType==='inmuebles') return calcInmuebles();
  if(activeType==='cdt') return calcCDT();
  if(activeType==='etf') return calcETF();
  if(activeType==='cripto') return calcCripto();
  if(activeType==='negocios') return calcNegocio();
  return calcOtra();
}
function updateDashboard({initial,gain,divs,expected,horizon,points,metrics,reasons,chartGrowth,type,loan,loanCountedInScore,raw}={}){
  loan = loan || {active:false,amount:0,rate:0,interest:0};
  if(loan.active){
    gain = gain - loan.interest;
    if(!loanCountedInScore){
      const spread=expected-loan.rate;
      points = points.concat(spread>.02?1:spread>=0?.5:0);
    }
    const lr = loanReason(expected,loan);
    if(lr) reasons = reasons.concat(lr);
  }
  let cl=classify(points);
  const totalReturn=(initial+gain+divs)/initial-1;
  if(totalReturn<0) cl={...cl,kind:'bad'};
  renderState(cl.kind);
  $('verdictText').textContent=cl.kind==='good'?T('analyzer.verdict.msg.good','La inversión muestra señales favorables según los supuestos ingresados.'):cl.kind==='neutral'?T('analyzer.verdict.msg.neutral','Hay señales mixtas. Conviene revisar supuestos, riesgos y fuentes antes de sacar conclusiones.'):T('analyzer.verdict.msg.bad','Varios supuestos o indicadores son débiles. Conviene ser prudente y profundizar el análisis.');
  $('scoreValue').textContent=`${cl.score.toFixed(1).replace('.',',')} / ${cl.max}`;
  $('returnPct').textContent=pct(expected); $('gain').textContent=money(gain); $('totalReturn').textContent=pct((initial+gain+divs)/initial-1); $('horizonLabel').textContent=horizon; $('totalYears').textContent=horizon; $('initialText').textContent=money(initial); $('finalText').textContent=money(initial+gain); $('yearsText').textContent=horizon; $('projRate').textContent=pct(expected); $('sInitial').textContent=money(initial); $('sGain').textContent=money(gain); $('sDiv').textContent=money(divs); $('sFinal').textContent=money(initial+gain+divs); $('sTotal').textContent=pct((initial+gain+divs)/initial-1); $('sYears').textContent=horizon;
  const ownRow=$('sOwnReturnRow');
  if(loan.active){
    const ownCapital=Math.max(1,initial-loan.amount);
    const ownReturn=(gain+divs)/ownCapital;
    $('sOwnReturn').textContent=pct(ownReturn);
    ownRow.style.display='';
  } else {
    ownRow.style.display='none';
  }
  const ids=['per','roe','pb','dy','cagr','mos']; metrics.forEach((m,i)=>{ if($(ids[i])) $(ids[i]).textContent=m.value; if($(`${ids[i]}Eval`)) setEval(`${ids[i]}Eval`,m.kind,m.label); });
  $('whyList').innerHTML=reasons.map(x=>`<li>✓ ${x}</li>`).join('');
  const resultTitles={
    acciones:T('analyzer.resulttitle.acciones','Resultados de la acción'),
    inmuebles:T('analyzer.resulttitle.inmuebles','Resultados del inmueble'),
    cdt:T('analyzer.resulttitle.cdt','Resultados del CDT / renta fija'),
    etf:T('analyzer.resulttitle.etf','Resultados del ETF / fondo'),
    cripto:T('analyzer.resulttitle.cripto','Resultados de la criptomoneda'),
    negocios:T('analyzer.resulttitle.negocios','Resultados del negocio / proyecto'),
    otra:T('analyzer.resulttitle.otra','Resultados de la inversión')
  };
  $('resultsTitleText').textContent=resultTitles[type]||resultTitles.otra;
  drawChart(initial,chartGrowth,horizon);
  checkChallenges(type,raw,expected,loan);
}
function calcAcciones(){
  const price=n('price'), shares=Math.max(1,n('shares')), div=n('dividend'), dg=n('divGrowth')/100, growth=n('growth')/100, eps=n('eps'), book=n('book'), disc=n('discount')/100, horizon=Math.max(1,n('horizon'));
  const initial=price*shares, per=eps?price/eps:0, earningsYield=per?1/per:0, roe=book?eps/book:0, pb=book?price/book:0, dy=price?div/price:0; const fair=(disc>dg&&div)?(div*(1+dg)/(disc-dg)):0; const mos=fair?clamp((fair-price)/fair,0,1):0; const gain=initial*((1+growth)**horizon-1); const divs=dg?div*shares*(((1+dg)**horizon-1)/dg):div*shares*horizon; const expected=dy+growth;
  const loan=getLoanInfo(initial,horizon);
  const arr=[relDisc(earningsYield,disc,1.3,1),relDisc(roe,disc,1.5,1),pb<1?'good':pb<2?'neutral':'bad',relDisc(dy,disc,.5,.25),relDisc(growth,disc,1,.6),mos>.30?'good':mos>.10?'neutral':'bad'];
  const evalLabel=k=>k==='good'?EVAL_FAV():k==='neutral'?EVAL_NEU():EVAL_UNFAV();
  const points=arr.map(k=>k==='good'?1:k==='neutral'?.5:0); const metrics=[{value:per.toFixed(1).replace('.',','),kind:arr[0],label:evalLabel(arr[0])},{value:pct(roe,0),kind:arr[1],label:evalLabel(arr[1])},{value:pb.toFixed(1).replace('.',','),kind:arr[2],label:evalLabel(arr[2])},{value:pct(dy),kind:arr[3],label:evalLabel(arr[3])},{value:pct(growth),kind:arr[4],label:evalLabel(arr[4])},{value:pct(mos),kind:arr[5],label:evalLabel(arr[5])}];
  const reasons=[]; if(arr[0]==='good')reasons.push(T('analyzer.reason.acciones.perLow','El PER es bajo frente a tu tasa de descuento.')); else if(arr[0]==='bad')reasons.push(T('analyzer.reason.acciones.perHigh','El PER es elevado frente a tu tasa de descuento.')); if(arr[1]==='good')reasons.push(T('analyzer.reason.acciones.roeGood','El ROE supera cómodamente tu tasa de descuento.')); else if(arr[1]==='bad')reasons.push(T('analyzer.reason.acciones.roeLow','El ROE es bajo frente a tu tasa de descuento y merece revisión.')); if(arr[3]==='good')reasons.push(T('analyzer.reason.acciones.dyGood','El dividendo representa un rendimiento atractivo frente a tu tasa de descuento.')); if(mos>.10)reasons.push(T('analyzer.reason.acciones.mosGood','El margen de seguridad estimado es {pct}%.').replace('{pct}',Math.round(mos*100))); else reasons.push(T('analyzer.reason.acciones.mosLow','El margen de seguridad es reducido en este escenario.'));
  updateDashboard({initial,gain,divs,expected,horizon,points,metrics,reasons,chartGrowth:growth,type:'acciones',loan,raw:{mos}});
}
function calcInmuebles(){
  const price=n('price'), units=Math.max(1,n('shares')), rent=n('dividend'), dg=n('divGrowth')/100, app=n('growth')/100, expenses=n('expenses'), occ=clamp(n('occupancy')/100,0,1), disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=price*units; const netAnnual=Math.max(0,(rent*12*occ-expenses*12))*units; const gross=price?rent*12*occ/price:0; const net=price?netAnnual/initial:0; const gain=initial*((1+app)**horizon-1); const divs=netAnnual*((1+dg)**horizon-1)/(dg||1)*1; const expected=net+app; const payback=netAnnual?initial/netAnnual:Infinity;
  const loan=getLoanInfo(initial,horizon);
  const lab=(good,neutral)=>good?EVAL_FAV():neutral?EVAL_NEU():EVAL_LOW();
  const leverage=loanSpreadMetric(net,loan);
  const m=[{value:pct(gross),kind:relDisc(gross,disc,1.1,.8),label:lab(relDisc(gross,disc,1.1,.8)==='good',relDisc(gross,disc,1.1,.8)==='neutral')},{value:pct(net),kind:relDisc(net,disc,1,.7),label:lab(relDisc(net,disc,1,.7)==='good',relDisc(net,disc,1,.7)==='neutral')},{value:pct(app),kind:relDisc(app,disc,.9,.5),label:lab(relDisc(app,disc,.9,.5)==='good',relDisc(app,disc,.9,.5)==='neutral')},{value:pct(occ),kind:occ>.95?'good':occ>.85?'neutral':'bad',label:lab(occ>.95,occ>.85)},{value:leverage.value,kind:leverage.kind,label:leverage.label},{value:isFinite(payback)?payback.toFixed(1).replace('.',',')+' '+T('analyzer.unit.years','años'):'—',kind:payback<12?'good':payback<20?'neutral':'bad',label:payback<12?EVAL_FAV():payback<20?EVAL_NEU():EVAL_LONG()}];
  const points=m.map(x=>x.kind==='good'?1:x.kind==='neutral'?.5:0);
  const reasons=[T('analyzer.reason.inmuebles.net','Rendimiento neto estimado: {v} al año.').replace('{v}',pct(net)),T('analyzer.reason.inmuebles.occ','Ocupación asumida: {v}.').replace('{v}',pct(occ)),T('analyzer.reason.inmuebles.payback','Recuperación simple aproximada: {v} años.').replace('{v}',isFinite(payback)?payback.toFixed(1):'—')];
  updateDashboard({initial,gain,divs,expected,horizon,points,metrics:m,reasons,chartGrowth:app,type:'inmuebles',loan,loanCountedInScore:true,raw:{net}});
}
function calcCDT(){
  const principal=n('price'), rate=n('growth')/100, years=Math.max(.1,n('horizon')), inf=n('inflation')/100, tax=n('tax')/100, disc=n('discount')/100; const initial=principal, gross=principal*((1+rate)**years-1), afterTax=gross*(1-tax), gain=afterTax, divs=0, expected=years>0?((1+afterTax/principal)**(1/years)-1):0; const real=(1+expected)/(1+inf)-1; const requiredReal=disc-inf;
  const loan=getLoanInfo(initial,years);
  const leverage=loanSpreadMetric(expected,loan);
  const points=[relDisc(rate,disc,1,.7),relDisc(expected,disc,1,.7),real>requiredReal?'good':real>0?'neutral':'bad',years<=2?'good':years<=4?'neutral':'bad',tax<.1?'good':tax<.15?'neutral':'bad',leverage.kind];
  const P=['analyzer.pill.cdt.0','Tasa'],P1=['analyzer.pill.cdt.1','Rendimiento neto'],P2=['analyzer.pill.cdt.2','Real'],P3=['analyzer.pill.cdt.3','Plazo'],P4=['analyzer.pill.cdt.4','Impuestos'];
  const metrics=[{value:pct(rate),kind:points[0],label:T(...P)},{value:pct(expected),kind:points[1],label:T(...P1)},{value:pct(real),kind:points[2],label:T(...P2)},{value:years.toFixed(1)+' '+T('analyzer.unit.years','años'),kind:points[3],label:T(...P3)},{value:pct(tax),kind:points[4],label:T(...P4)},{value:leverage.value,kind:leverage.kind,label:leverage.label}];
  updateDashboard({initial,gain,divs,expected,horizon:years,points:points.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.cdt.gain','Ganancia estimada después de retención: {v}.').replace('{v}',money(gain)),T('analyzer.reason.cdt.real','Rendimiento real frente a inflación: {v}.').replace('{v}',pct(real)),T('analyzer.reason.cdt.term','El plazo es de {v} años.').replace('{v}',years)],chartGrowth:expected,type:'cdt',loan,loanCountedInScore:true,raw:{real}});
}
function calcETF(){
  const price=n('price'), shares=Math.max(1,n('shares')), div=n('dividend'), growth=n('growth')/100, dg=n('divGrowth')/100, ter=n('expensesRate')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=price*shares; const netGrowth=growth-ter; const gain=initial*((1+Math.max(-.99,netGrowth))**horizon-1); const dy=price?div/price:0; const divs=dg?div*shares*(((1+dg)**horizon-1)/dg):div*shares*horizon; const expected=dy+netGrowth; const costEfficiency=growth?netGrowth/growth:1;
  const loan=getLoanInfo(initial,horizon);
  const leverage=loanSpreadMetric(expected,loan);
  const pts=[relDisc(netGrowth,disc,.9,.5),relDisc(dy,disc,.4,.2),ter<.003?'good':ter<.008?'neutral':'bad',costEfficiency>.9?'good':costEfficiency>.7?'neutral':'bad',leverage.kind,shares>0?'good':'bad'];
  const metrics=[{value:pct(netGrowth),kind:pts[0],label:T('analyzer.pill.etf.0','Neto')},{value:pct(dy),kind:pts[1],label:T('analyzer.pill.etf.1','Favorable')},{value:pct(ter),kind:pts[2],label:T('analyzer.pill.etf.2','Bajo costo')},{value:pct(costEfficiency),kind:pts[3],label:T('analyzer.pill.etf.3','Eficiencia')},{value:leverage.value,kind:leverage.kind,label:leverage.label},{value:shares.toString(),kind:pts[5],label:T('analyzer.pill.etf.5','Participaciones')}];
  updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.etf.growth','Crecimiento neto estimado después de TER: {v}.').replace('{v}',pct(netGrowth)),T('analyzer.reason.etf.dy','Dividend Yield estimado: {v}.').replace('{v}',pct(dy)),T('analyzer.reason.etf.cost','Costo anual del fondo: {v}.').replace('{v}',pct(ter))],chartGrowth:netGrowth,type:'etf',loan,loanCountedInScore:true,raw:{costEfficiency}});
}
function calcCripto(){
  const price=n('price'), units=Math.max(0.00001,n('shares')), growth=n('growth')/100, staking=n('staking')/100, volatility=clamp(n('volatility')||7,1,10), fees=n('fees')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon'));
  const initial=price*units; const netGrowth=growth-fees; const gain=initial*((1+Math.max(-.99,netGrowth))**horizon-1); const divs=staking?initial*staking*horizon:0; const expected=netGrowth+staking; const cushion=expected>0?clamp((expected-disc)/expected,0,1):0;
  const loan=getLoanInfo(initial,horizon);
  const leverage=loanSpreadMetric(expected,loan);
  const evalLabel=k=>k==='good'?EVAL_FAV():k==='neutral'?EVAL_NEU():EVAL_UNFAV();
  const volKind=volatility<=4?'good':volatility<=7?'neutral':'bad';
  const feesKind=fees<.01?'good':fees<.03?'neutral':'bad';
  const pts=[relDisc(netGrowth,disc,1,.6),relDisc(staking,disc,.4,.15),volKind,feesKind,leverage.kind,cushion>.30?'good':cushion>.10?'neutral':'bad'];
  const metrics=[{value:pct(netGrowth),kind:pts[0],label:evalLabel(pts[0])},{value:pct(staking),kind:pts[1],label:staking>0?evalLabel(pts[1]):T('analyzer.eval.none','Sin staking')},{value:volatility.toFixed(0)+'/10',kind:volKind,label:evalLabel(volKind)},{value:pct(fees),kind:feesKind,label:evalLabel(feesKind)},{value:leverage.value,kind:leverage.kind,label:leverage.label},{value:pct(cushion),kind:pts[5],label:evalLabel(pts[5])}];
  const reasons=[T('analyzer.reason.cripto.growth','Crecimiento neto estimado después de comisiones: {v}.').replace('{v}',pct(netGrowth))];
  if(staking>0) reasons.push(T('analyzer.reason.cripto.staking','El staking aporta un rendimiento adicional de {v} al año.').replace('{v}',pct(staking)));
  if(volatility>=7) reasons.push(T('analyzer.reason.cripto.volHigh','La volatilidad que ingresaste es alta ({v}/10); considera invertir solo una porción pequeña de tu portafolio.').replace('{v}',volatility.toFixed(0)));
  else if(volatility<=3) reasons.push(T('analyzer.reason.cripto.volLow','La volatilidad que ingresaste es relativamente baja para una criptomoneda ({v}/10).').replace('{v}',volatility.toFixed(0)));
  updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons,chartGrowth:netGrowth,type:'cripto',loan,loanCountedInScore:true,raw:{netGrowth,volatility,cushion}});
}
function calcNegocio(){
  const inv=n('price'), units=Math.max(1,n('shares')), revenue=n('revenue'), margin=n('margin')/100, growth=n('growth')/100, expenses=n('expenses'), disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=inv*units, profit=Math.max(0,revenue*margin-expenses)*units, gain=profit*((1+growth)**horizon-1), divs=profit*0.6*((1+growth)**horizon-1)/(growth||1), expected=initial?profit/initial+growth:0, roi=initial?profit/initial:0, payback=profit?initial/profit:Infinity;
  const loan=getLoanInfo(initial,horizon);
  const leverage=loanSpreadMetric(expected,loan);
  const pts=[relDisc(roi,disc,1.5,1),margin>.25?'good':margin>.12?'neutral':'bad',relDisc(growth,disc,1,.6),leverage.kind,payback<5?'good':payback<8?'neutral':'bad',profit>0?'good':'bad'];
  const metrics=[{value:pct(roi),kind:pts[0],label:T('analyzer.pill.negocios.0','ROI')},{value:pct(margin),kind:pts[1],label:T('analyzer.pill.negocios.1','Margen')},{value:pct(growth),kind:pts[2],label:T('analyzer.pill.negocios.2','Crecimiento')},{value:leverage.value,kind:leverage.kind,label:leverage.label},{value:isFinite(payback)?payback.toFixed(1).replace('.',',')+' '+T('analyzer.unit.years','años'):'—',kind:pts[4],label:T('analyzer.pill.negocios.4','Recuperación')},{value:pct(profit?profit/revenue:0),kind:pts[5],label:T('analyzer.pill.negocios.5','Margen real')}];
  updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.negocios.profit','Utilidad anual estimada: {v}.').replace('{v}',money(profit)),T('analyzer.reason.negocios.roi','ROI simple estimado: {v}.').replace('{v}',pct(roi)),T('analyzer.reason.negocios.payback','Recuperación aproximada: {v} años.').replace('{v}',isFinite(payback)?payback.toFixed(1):'—')],chartGrowth:growth,type:'negocios',loan,loanCountedInScore:true,raw:{roi}});
}
function calcOtra(){
  const initial=n('price')*Math.max(1,n('shares')), income=n('dividend'), costs=n('expenses'), growth=n('growth')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const net=Math.max(0,income-costs), ret=initial?net/initial:0, gain=initial*((1+growth)**horizon-1), divs=net*horizon, expected=ret+growth; const efficiency=income?net/income:0;
  const loan=getLoanInfo(initial,horizon);
  const leverage=loanSpreadMetric(expected,loan);
  const pts=[relDisc(ret,disc,1.2,.7),relDisc(growth,disc,1,.6),leverage.kind,net>0?'good':'bad',efficiency>.5?'good':efficiency>.2?'neutral':'bad',initial>0?'good':'bad'];
  const metrics=[{value:pct(ret),kind:pts[0],label:T('analyzer.pill.otra.0','Rendimiento')},{value:pct(growth),kind:pts[1],label:T('analyzer.pill.otra.1','Crecimiento')},{value:leverage.value,kind:leverage.kind,label:leverage.label},{value:money(net),kind:pts[3],label:T('analyzer.pill.otra.3','Neto anual')},{value:pct(efficiency),kind:pts[4],label:T('analyzer.pill.otra.4','Eficiencia')},{value:initial>0?'✓':'—',kind:pts[5],label:T('analyzer.pill.otra.5','Datos completos')}];
  updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.otra.income','Ingreso neto anual estimado: {v}.').replace('{v}',money(net)),T('analyzer.reason.otra.ret','Rentabilidad directa estimada: {v}.').replace('{v}',pct(ret)),T('analyzer.reason.otra.growth','Crecimiento supuesto: {v}.').replace('{v}',pct(growth))],chartGrowth:growth,type:'otra',loan,loanCountedInScore:true,raw:{ret,net}});
}

function drawChart(initial,growth,horizon){const c=$('chart'); if(!c)return; const ctx=c.getContext('2d'),w=c.clientWidth||670,h=215,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const vals=[];for(let i=0;i<=Math.min(Math.ceil(horizon),8);i++)vals.push(initial*Math.pow(1+growth,i));const max=Math.max(...vals)*1.1,pad={l:52,r:15,t:16,b:32},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;ctx.strokeStyle=document.body.classList.contains('dark')?'#334b4b':'#cdd7d0';ctx.font='10px Segoe UI';ctx.fillStyle=document.body.classList.contains('dark')?'#b9cbc5':'#52645e';ctx.textAlign='right';for(let j=0;j<=4;j++){const y=pad.t+ch*j/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(money((max-(max)*j/4)/1),pad.l-6,y+3)}const bw=cw/vals.length*.55;ctx.textAlign='center';const todayLabel=T('analyzer.chart.today','Hoy'),ySing=T('analyzer.chart.year.singular','año'),yPlur=T('analyzer.chart.year.plural','años');for(let i=0;i<vals.length;i++){const x=pad.l+cw*(i+.5)/vals.length,bh=vals[i]/max*ch,y=pad.t+ch-bh;ctx.fillStyle='#8bc53f';ctx.fillRect(x-bw/2,y,bw,bh);ctx.fillStyle=document.body.classList.contains('dark')?'#d9ecba':'#315a35';ctx.font='bold 10px Segoe UI';ctx.fillText(money(vals[i]),x,y-6);ctx.fillStyle=document.body.classList.contains('dark')?'#b9cbc5':'#52645e';ctx.font='10px Segoe UI';ctx.fillText(i===0?todayLabel:`${i} ${i!==1?yPlur:ySing}`,x,h-8)}}

function nav(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));const target=$(`page-${page}`);if(target)target.classList.add('active-page');document.querySelectorAll('.side-item').forEach(b=>b.classList.remove('selected'));document.querySelectorAll(`[data-page="${page}"]`).forEach(b=>b.classList.add('selected'));if(page==='comparar'&&!$('compareGrid').dataset.ready)buildCompare();if(page==='glosario')buildGlossary($('glossarySearch')?.value||'');if(page==='progreso')renderProgress();if(page==='aprende')return;}

// --- Retos --------------------------------------------------------------
const CHALLENGES=[
  {id:'ch_acciones_mos',type:'acciones',icon:'🎯',title:'analyzer.challenge.mos.title',desc:'analyzer.challenge.mos.desc',check:raw=>raw.mos>0.20},
  {id:'ch_inmuebles_net',type:'inmuebles',icon:'🏠',title:'analyzer.challenge.net.title',desc:'analyzer.challenge.net.desc',check:raw=>raw.net>0.06},
  {id:'ch_cdt_real',type:'cdt',icon:'🏦',title:'analyzer.challenge.real.title',desc:'analyzer.challenge.real.desc',check:raw=>raw.real>0},
  {id:'ch_etf_eff',type:'etf',icon:'📊',title:'analyzer.challenge.eff.title',desc:'analyzer.challenge.eff.desc',check:raw=>raw.costEfficiency>0.9},
  {id:'ch_cripto_cushion',type:'cripto',icon:'🪙',title:'analyzer.challenge.cripto.title',desc:'analyzer.challenge.cripto.desc',check:raw=>raw.cushion>0.30&&raw.volatility<=7},
  {id:'ch_negocios_roi',type:'negocios',icon:'💼',title:'analyzer.challenge.roi.title',desc:'analyzer.challenge.roi.desc',check:raw=>raw.roi>0.30},
  {id:'ch_otra_positive',type:'otra',icon:'🧩',title:'analyzer.challenge.otra.title',desc:'analyzer.challenge.otra.desc',check:raw=>raw.ret>0&&raw.net>0},
  {id:'ch_loan_carry',type:null,icon:'⚖️',title:'analyzer.challenge.loan.title',desc:'analyzer.challenge.loan.desc',check:(raw,expected,loan)=>loan&&loan.active&&(expected-loan.rate)>0.02},
  {id:'ch_compare',type:'comparar',icon:'⚔️',title:'analyzer.challenge.compare.title',desc:'analyzer.challenge.compare.desc',check:()=>false}
];
function getChallenges(){try{return JSON.parse(localStorage.getItem('mm_challenges')||'[]')}catch(e){return[]}}
function saveChallenges(c){localStorage.setItem('mm_challenges',JSON.stringify(c))}
function checkChallenges(type,raw,expected,loan){
  const done=getChallenges();
  const newlyDone=[];
  CHALLENGES.forEach(c=>{
    if(done.includes(c.id))return;
    if(c.type&&c.type!==type)return;
    if(c.type===null&&type===undefined)return;
    try{ if(c.check(raw||{},expected,loan)){done.push(c.id);newlyDone.push(c)} }catch(e){}
  });
  if(newlyDone.length){
    saveChallenges(done);
    const names=newlyDone.map(c=>T(c.title,'')).join(', ');
    showSaveToast(T('analyzer.challenge.toast','¡Reto completado! ')+names+' 🏆');
    if($('page-progreso')?.classList.contains('active-page'))renderProgress();
  }
}
function renderChallenges(){
  const done=getChallenges();
  $('challengesGrid').innerHTML=CHALLENGES.map(c=>{
    const earned=done.includes(c.id);
    return `<div class="badge-item${earned?' earned':''}"><div class="badge-icon">${c.icon}</div><b>${T(c.title,'')}</b><small>${earned?T('analyzer.progress.earned','¡Desbloqueada!'):T(c.desc,'')}</small></div>`;
  }).join('');
}
function getBadges(){try{return JSON.parse(localStorage.getItem('mm_badges')||'[]')}catch(e){return[]}}
function saveBadges(b){localStorage.setItem('mm_badges',JSON.stringify(b))}
function getHistory(){try{return JSON.parse(localStorage.getItem('mm_history')||'[]')}catch(e){return[]}}
function saveHistory(h){localStorage.setItem('mm_history',JSON.stringify(h))}
function currentVerdictKind(){const el=$('verdict');if(!el)return'neutral';if(el.classList.contains('verdict-good'))return'good';if(el.classList.contains('verdict-bad'))return'bad';return'neutral'}
const BADGE_ORDER=['acciones','inmuebles','cdt','etf','cripto','negocios','otra'];
function renderProgress(){
  renderChallenges();
  const badges=getBadges();
  $('badgesGrid').innerHTML=BADGE_ORDER.map(t=>{
    const earned=badges.includes(t);
    return `<div class="badge-item${earned?' earned':''}"><div class="badge-icon">${TYPE[t].icon}</div><b>${TYPE[t].title}</b><small>${earned?T('analyzer.progress.earned','¡Desbloqueada!'):T('analyzer.progress.locked','Guarda un análisis para desbloquear')}</small></div>`;
  }).join('');
  const history=getHistory();
  if(!history.length){
    $('historyList').innerHTML=`<div class="history-empty">${T('analyzer.progress.empty','Todavía no has guardado ningún análisis. Ve a "Analiza tu inversión" y presiona "Guardar este análisis".')}</div>`;
    return;
  }
  $('historyList').innerHTML=history.map(h=>{
    const icon=TYPE[h.type]?TYPE[h.type].icon:'📊';
    let dateStr=h.date;
    try{dateStr=new Date(h.date).toLocaleDateString()}catch(e){}
    return `<div class="history-item"><span class="h-icon">${icon}</span><div class="h-main"><div class="h-name">${h.name}</div><div class="h-date">${dateStr}</div></div><span class="h-verdict ${h.verdictKind}">${h.verdictLabel}</span></div>`;
  }).join('');
}
function showSaveToast(msg){
  const el=$('saveAnalysisToast');if(!el)return;
  el.textContent=msg;el.style.display='block';
  clearTimeout(el._t);el._t=setTimeout(()=>{el.style.display='none'},4000);
}
function saveCurrentAnalysis(){
  const type=activeType;
  const name=$('name')?.value||TYPE[type].title;
  const verdictKind=currentVerdictKind();
  const verdictLabel=$('verdict')?$('verdict').textContent:'';
  const entry={type,name,verdictKind,verdictLabel,returnPct:$('returnPct')?$('returnPct').textContent:'',date:new Date().toISOString()};
  const history=getHistory();
  history.unshift(entry);
  if(history.length>20)history.length=20;
  saveHistory(history);
  const badges=getBadges();
  let newBadge=false;
  if(!badges.includes(type)){badges.push(type);saveBadges(badges);newBadge=true}
  showSaveToast(newBadge?T('analyzer.progress.toastBadge','¡Guardado! Desbloqueaste una insignia nueva 🏅'):T('analyzer.progress.toastSaved','Análisis guardado ✓'));
}
function selectAnalysisType(type){document.querySelectorAll('.analysis-type').forEach(b=>b.classList.toggle('selected',b.dataset.analysisType===type));nav('analiza');setAnalysisForm(type)}
function buildCompare(){const g=$('compareGrid');const invLabel=T('analyzer.compare.cardtitle','Inversión');const defNames=[T('analyzer.compare.default.acciones','Ecopetrol'),T('analyzer.compare.default.cdt','CDT'),T('analyzer.compare.default.etf','ETF')];g.innerHTML=['A','B','C'].map((x,i)=>`<div class="compare-card"><h3>${invLabel} ${x}</h3><label>${T('analyzer.compare.name','Nombre')} <input data-cmp="name${i}" value="${defNames[i]||''}"></label><label>${T('analyzer.compare.return','Rentabilidad anual')} <input data-cmp="ret${i}" type="number" value="${i===0?13.8:i===1?9:11}" step="0.1">%</label><label>${T('analyzer.compare.risk','Riesgo (1-10)')} <input data-cmp="risk${i}" type="number" min="1" max="10" value="${i+3}"></label><label>${T('analyzer.compare.liquidity','Liquidez (1-10)')} <input data-cmp="liq${i}" type="number" min="1" max="10" value="${10-i*2}"></label><label>${T('analyzer.compare.horizon','Horizonte (años)')} <input data-cmp="hor${i}" type="number" min="1" value="5"></label><div class="compare-result"><span class="state-chip chip-neutral" data-cmpout="${i}">${T('analyzer.kind.neutral','REGULAR')}</span><b data-cmpscore="${i}">${T('analyzer.compare.score','Puntaje')} 0/100</b></div></div>`).join('');g.dataset.ready='1';g.querySelectorAll('input').forEach(i=>i.addEventListener('input',scoreCompare));scoreCompare()}
function scoreCompare(){
  let bestScore=0;
  document.querySelectorAll('.compare-card').forEach((c,i)=>{const ret=parseFloat(c.querySelector(`[data-cmp="ret${i}"]`).value)||0,risk=parseFloat(c.querySelector(`[data-cmp="risk${i}"]`).value)||5,liq=parseFloat(c.querySelector(`[data-cmp="liq${i}"]`).value)||5;const s=clamp(ret*4+(10-risk)*4+liq*2,0,100),kind=s>=70?'good':s>=50?'neutral':'bad',d=kindData(kind),chip=c.querySelector(`[data-cmpout="${i}"]`);chip.className=`state-chip chip-${kind}`;chip.textContent=d.label;c.querySelector(`[data-cmpscore="${i}"]`).textContent=`${T('analyzer.compare.score','Puntaje')} ${Math.round(s)}/100`;if(s>bestScore)bestScore=s});
  if(bestScore>=70){
    const done=getChallenges();
    if(!done.includes('ch_compare')){
      done.push('ch_compare');saveChallenges(done);
      showSaveToast(T('analyzer.challenge.toast','¡Reto completado! ')+T('analyzer.challenge.compare.title','')+' 🏆');
      if($('page-progreso')?.classList.contains('active-page'))renderProgress();
    }
  }
}
function calcWhatIf(){const price=n('wfPrice'),growth=n('wfGrowth')/100,disc=n('wfDiscount')/100,years=Math.max(1,n('wfYears'));const v=price*Math.pow(1+growth,years), margin=disc>0?((v-price)/v):0, ratio=price>0?v/price:0,kind=ratio>1.7&&margin>.1?'good':ratio>1.35?'neutral':'bad';$('wfValue').textContent=money(v);$('wfReturn').textContent=pct(growth);$('wfMargin').textContent=pct(margin);const b=$('wfBadge');b.className='scenario-badge '+kind;b.textContent=kindData(kind).label}

const GLOSSARY_COUNT = 61;
function buildGlossaryData(){
  const arr=[];
  for(let i=0;i<GLOSSARY_COUNT;i++){
    const term=T(`analyzer.glossary.${i}.term`,null);
    const def=T(`analyzer.glossary.${i}.def`,null);
    if(term&&def) arr.push([term,def]);
  }
  return arr;
}
function buildGlossary(filter=''){const g=$('glossaryGrid');const f=filter.toLowerCase();const glossary=buildGlossaryData();g.innerHTML=glossary.filter(x=>x[0].toLowerCase().includes(f)||x[1].toLowerCase().includes(f)).map(x=>`<div class="glossary-item"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')||`<div class="card" style="padding:20px">${T('analyzer.glossary.empty','No encontramos ese término.')}</div>`;g.dataset.ready='1'}
function setupDark(){const saved=localStorage.getItem('mm_dark')==='1';$('darkMode').checked=saved;document.body.classList.toggle('dark',saved);}
function closeMobileMenu(){document.body.classList.remove('menu-open');}
function setupMobileMenu(){const btn=$('mobileMenuBtn');if(!btn)return;btn.addEventListener('click',()=>document.body.classList.toggle('menu-open'));document.querySelectorAll('.side-item').forEach(b=>b.addEventListener('click',closeMobileMenu));}

function refreshDynamicContent(){
  // Re-render everything app.js generates in JS, using the freshly loaded dictionary.
  Object.assign(TYPE, {
    acciones:{title:T('analyzer.type.acciones.title','Acciones'),icon:'📈',subtitle:T('analyzer.type.acciones.subtitle','Analiza una empresa y sus indicadores de valoración, rentabilidad y crecimiento.')},
    inmuebles:{title:T('analyzer.type.inmuebles.title','Inmuebles'),icon:'🏠',subtitle:T('analyzer.type.inmuebles.subtitle','Estudia precio, renta, gastos, ocupación, valorización y rendimiento del inmueble.')},
    cdt:{title:T('analyzer.type.cdt.title','CDT / Renta fija'),icon:'🏦',subtitle:T('analyzer.type.cdt.subtitle','Calcula rendimiento de un CDT o instrumento de renta fija considerando plazo y tasa.')},
    etf:{title:T('analyzer.type.etf.title','ETF / Fondos'),icon:'📊',subtitle:T('analyzer.type.etf.subtitle','Analiza costos, dividendos, crecimiento esperado y rendimiento de un ETF o fondo.')},
    cripto:{title:T('analyzer.type.cripto.title','Criptomonedas'),icon:'🪙',subtitle:T('analyzer.type.cripto.subtitle','Analiza precio, volatilidad, staking y crecimiento esperado de una criptomoneda.')},
    negocios:{title:T('analyzer.type.negocios.title','Negocios / Proyectos'),icon:'💼',subtitle:T('analyzer.type.negocios.subtitle','Evalúa retorno, margen, crecimiento, recuperación de la inversión y riesgo del proyecto.')},
    otra:{title:T('analyzer.type.otra.title','Otra inversión'),icon:'🧩',subtitle:T('analyzer.type.otra.subtitle','Usa un modelo general para estudiar inversiones que no encajan en las categorías anteriores.')}
  });
  setAnalysisForm(activeType);
  if($('compareGrid')?.dataset.ready) buildCompare();
  buildGlossary($('glossarySearch')?.value||'');
  calcWhatIf();
  if($('page-progreso')?.classList.contains('active-page')) renderProgress();
  applyMode();
}
document.addEventListener('mm:lang-changed', refreshDynamicContent);

function getMode(){return localStorage.getItem('mm_mode')==='avanzado'?'avanzado':'simple'}
function setModeLocal(mode){localStorage.setItem('mm_mode',mode)}
function applyMode(){
  const mode=getMode();
  $('modeSimple')?.classList.toggle('active',mode==='simple');
  $('modeAdvanced')?.classList.toggle('active',mode==='avanzado');
  const details=$('advancedDetails'),btn=$('toggleDetailsBtn');
  if(!details||!btn)return;
  if(mode==='avanzado'){
    details.style.display='';
    btn.style.display='none';
  } else {
    details.style.display='none';
    btn.style.display='block';
    btn.textContent=T('analyzer.simple.showDetails','Ver detalles técnicos ▾');
  }
}

function wire(){
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.analysisType) selectAnalysisType(b.dataset.analysisType); else nav(b.dataset.page); }));
  $('glossarySearch')?.addEventListener('input',e=>buildGlossary(e.target.value));
  $('loanNo').onclick=()=>{$('loanNo').classList.add('active');$('loanYes').classList.remove('active');calc()};
  $('loanYes').onclick=()=>{
    $('loanYes').classList.add('active');$('loanNo').classList.remove('active');calc();
    if(localStorage.getItem('mm_loan_tip_seen')!=='1'){ $('moroLoanTip').style.display='flex'; }
  };
  $('moroLoanTipClose')?.addEventListener('click',()=>{ $('moroLoanTip').style.display='none'; localStorage.setItem('mm_loan_tip_seen','1'); });
  ['loanAmount','loanRate','loanYears'].forEach(id=>$(id)?.addEventListener('input',calc));
  $('saveAnalysisBtn')?.addEventListener('click',saveCurrentAnalysis);
  $('clearHistoryBtn')?.addEventListener('click',()=>{
    if(confirm(T('analyzer.progress.clearConfirm','¿Borrar todo tu historial de práctica? Las insignias ya ganadas no se pierden.'))){
      saveHistory([]);
      renderProgress();
    }
  });
  $('appName').addEventListener('input',e=>{document.querySelector('.title').textContent=e.target.value;document.title=e.target.value;localStorage.setItem('mm_app_name',e.target.value)});
  const savedName=localStorage.getItem('mm_app_name');if(savedName){$('appName').value=savedName;document.querySelector('.title').textContent=savedName;document.title=savedName}
  $('currency').value=currentCurrency; $('currency').addEventListener('change',e=>{currentCurrency=e.target.value;localStorage.setItem('mm_currency',currentCurrency);calc();calcWhatIf();});
  $('darkMode').addEventListener('change',e=>{document.body.classList.toggle('dark',e.target.checked);localStorage.setItem('mm_dark',e.target.checked?'1':'0');calc();});
  $('showWarnings').addEventListener('change',e=>document.querySelector('.warning').style.display=e.target.checked?'block':'none');
  window.addEventListener('resize',calc);
  $('analysisFormGrid')?.addEventListener('click',e=>{
    const btn=e.target.closest('.field-lookup-btn');
    if(btn)handleLookup(btn);
  });
  $('modeSimple')?.addEventListener('click',()=>{setModeLocal('simple');applyMode();setAnalysisForm(activeType)});
  $('modeAdvanced')?.addEventListener('click',()=>{setModeLocal('avanzado');applyMode();setAnalysisForm(activeType)});
  $('toggleDetailsBtn')?.addEventListener('click',()=>{
    const details=$('advancedDetails');
    const expanded=details.style.display!=='none';
    details.style.display=expanded?'none':'';
    $('toggleDetailsBtn').textContent=expanded?T('analyzer.simple.showDetails','Ver detalles técnicos ▾'):T('analyzer.simple.hideDetails','Ocultar detalles técnicos ▴');
  });
  applyMode();
  setupDark(); setupMobileMenu(); selectAnalysisType('acciones'); calcWhatIf(); buildGlossary('');
}
wire();

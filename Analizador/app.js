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

function setAnalysisForm(type){
  activeType=type;
  const c=TYPE[type];
  $('analysisTitle').textContent=c.title; $('analysisIcon').textContent=c.icon; $('analysisSubtitle').textContent=c.subtitle;
  const g=$('analysisFormGrid');
  const templates={
    acciones:[
      [T('analyzer.field.acciones.name','Nombre de la acción'),'text','name',T('analyzer.default.acciones.name','Ecopetrol (ECOPETROL)')],[T('analyzer.field.acciones.price','Precio actual por acción'),'number','price','1950'],[T('analyzer.field.acciones.shares','Número de acciones que comprarás'),'number','shares','1000'],[T('analyzer.field.acciones.dividend','Dividendo anual por acción'),'number','dividend','120'],[T('analyzer.field.acciones.divGrowth','Crecimiento esperado del dividendo (%)'),'number','divGrowth','5'],[T('analyzer.field.acciones.growth','Crecimiento esperado de la empresa (%)'),'number','growth','8'],[T('analyzer.field.acciones.eps','Utilidad por acción (EPS)'),'number','eps','240'],[T('analyzer.field.acciones.book','Valor en libros por acción'),'number','book','1000'],[T('analyzer.field.acciones.discount','Tasa de descuento / costo de oportunidad (%)'),'number','discount','10'],[T('analyzer.field.acciones.horizon','Horizonte de inversión (años)'),'number','horizon','5']
    ],
    inmuebles:[
      [T('analyzer.field.inmuebles.name','Nombre del inmueble'),'text','name',T('analyzer.default.inmuebles.name','Apartamento / Local')],[T('analyzer.field.inmuebles.price','Precio de compra'),'number','price','300000000'],[T('analyzer.field.inmuebles.shares','Cantidad de inmuebles'),'number','shares','1'],[T('analyzer.field.inmuebles.dividend','Arriendo mensual esperado'),'number','dividend','1800000'],[T('analyzer.field.inmuebles.divGrowth','Crecimiento anual del arriendo (%)'),'number','divGrowth','4'],[T('analyzer.field.inmuebles.growth','Valorización esperada anual (%)'),'number','growth','6'],[T('analyzer.field.inmuebles.expenses','Gastos mensuales'),'number','expenses','350000'],[T('analyzer.field.inmuebles.occupancy','Ocupación esperada (%)'),'number','occupancy','95'],[T('analyzer.field.inmuebles.discount','Tasa de descuento (%)'),'number','discount','10'],[T('analyzer.field.inmuebles.horizon','Horizonte (años)'),'number','horizon','10']
    ],
    cdt:[
      [T('analyzer.field.cdt.name','Nombre del producto'),'text','name',T('analyzer.default.cdt.name','CDT a 1 año')],[T('analyzer.field.cdt.price','Capital inicial'),'number','price','10000000'],[T('analyzer.field.cdt.shares','Unidades / cuentas'),'number','shares','1'],[T('analyzer.field.cdt.growth','Tasa efectiva anual (%)'),'number','growth','9'],[T('analyzer.field.cdt.horizon','Plazo (años)'),'number','horizon','1'],[T('analyzer.field.cdt.inflation','Inflación esperada (%)'),'number','inflation','5'],[T('analyzer.field.cdt.tax','Retención / impuestos (%)'),'number','tax','4'],[T('analyzer.field.cdt.discount','Tasa mínima exigida (%)'),'number','discount','8']
    ],
    etf:[
      [T('analyzer.field.etf.name','Nombre del ETF / fondo'),'text','name',T('analyzer.default.etf.name','ETF global')],[T('analyzer.field.etf.price','Precio actual por participación'),'number','price','400'],[T('analyzer.field.etf.shares','Participaciones'),'number','shares','25'],[T('analyzer.field.etf.dividend','Dividendos anuales por participación'),'number','dividend','6'],[T('analyzer.field.etf.growth','Crecimiento esperado (%)'),'number','growth','7'],[T('analyzer.field.etf.divGrowth','Crecimiento del dividendo (%)'),'number','divGrowth','4'],[T('analyzer.field.etf.expensesRate','Gastos del fondo / TER (%)'),'number','expensesRate','0.2'],[T('analyzer.field.etf.discount','Tasa de descuento (%)'),'number','discount','9'],[T('analyzer.field.etf.horizon','Horizonte (años)'),'number','horizon','5']
    ],
    negocios:[
      [T('analyzer.field.negocios.name','Nombre del proyecto'),'text','name',T('analyzer.default.negocios.name','Negocio / Proyecto')],[T('analyzer.field.negocios.price','Inversión inicial'),'number','price','50000000'],[T('analyzer.field.negocios.shares','Unidades / proyectos'),'number','shares','1'],[T('analyzer.field.negocios.revenue','Ingresos anuales esperados'),'number','revenue','30000000'],[T('analyzer.field.negocios.margin','Margen neto esperado (%)'),'number','margin','20'],[T('analyzer.field.negocios.growth','Crecimiento anual (%)'),'number','growth','8'],[T('analyzer.field.negocios.expenses','Gasto / inversión adicional anual'),'number','expenses','3000000'],[T('analyzer.field.negocios.discount','Tasa de descuento (%)'),'number','discount','12'],[T('analyzer.field.negocios.horizon','Horizonte (años)'),'number','horizon','5']
    ],
    otra:[
      [T('analyzer.field.otra.name','Nombre de la inversión'),'text','name',T('analyzer.default.otra.name','Mi inversión')],[T('analyzer.field.otra.price','Capital inicial'),'number','price','10000000'],[T('analyzer.field.otra.shares','Unidades / participaciones'),'number','shares','1'],[T('analyzer.field.otra.dividend','Ingreso o rendimiento anual'),'number','dividend','800000'],[T('analyzer.field.otra.growth','Crecimiento esperado (%)'),'number','growth','7'],[T('analyzer.field.otra.divGrowth','Crecimiento del ingreso (%)'),'number','divGrowth','3'],[T('analyzer.field.otra.expenses','Costos anuales'),'number','expenses','100000'],[T('analyzer.field.otra.discount','Tasa de descuento (%)'),'number','discount','10'],[T('analyzer.field.otra.horizon','Horizonte (años)'),'number','horizon','5']
    ]
  };
  const rows=templates[type];
  g.innerHTML=rows.map(r=>{
    const [label,kind,id,val]=r;
    const cls=kind==='number'?'number-input':'';
    return `<label>${label}</label><input class="${cls}" id="${id}" type="${kind}" value="${val}" step="any">`;
  }).join('');
  const formIds=rows.map(r=>r[2]);
  formIds.forEach(id=>$(id)?.addEventListener('input',calc));
  updateMeaning(type);
  const metricNames={
    acciones:[T('analyzer.metric.acciones.0','PER <small>(Price to Earnings)</small>'),T('analyzer.metric.acciones.1','ROE <small>(Return on Equity)</small>'),T('analyzer.metric.acciones.2','P/B <small>(Price to Book)</small>'),T('analyzer.metric.acciones.3','Dividend Yield'),T('analyzer.metric.acciones.4','CAGR <small>(Crecimiento anual)</small>'),T('analyzer.metric.acciones.5','Margen de seguridad')],
    inmuebles:[T('analyzer.metric.inmuebles.0','Rendimiento bruto'),T('analyzer.metric.inmuebles.1','Rendimiento neto'),T('analyzer.metric.inmuebles.2','Valorización anual'),T('analyzer.metric.inmuebles.3','Ocupación'),T('analyzer.metric.inmuebles.4','Retorno esperado'),T('analyzer.metric.inmuebles.5','Recuperación')],
    cdt:[T('analyzer.metric.cdt.0','Tasa efectiva anual'),T('analyzer.metric.cdt.1','Rendimiento neto'),T('analyzer.metric.cdt.2','Rendimiento real'),T('analyzer.metric.cdt.3','Plazo'),T('analyzer.metric.cdt.4','Retención / impuestos'),T('analyzer.metric.cdt.5','Exceso vs. tasa mínima')],
    etf:[T('analyzer.metric.etf.0','Crecimiento neto'),T('analyzer.metric.etf.1','Dividend Yield'),T('analyzer.metric.etf.2','TER <small>(costo del fondo)</small>'),T('analyzer.metric.etf.3','Rendimiento esperado'),T('analyzer.metric.etf.4','Horizonte'),T('analyzer.metric.etf.5','Exceso vs. mínimo')],
    negocios:[T('analyzer.metric.negocios.0','ROI'),T('analyzer.metric.negocios.1','Margen neto'),T('analyzer.metric.negocios.2','Crecimiento'),T('analyzer.metric.negocios.3','Rendimiento esperado'),T('analyzer.metric.negocios.4','Recuperación'),T('analyzer.metric.negocios.5','Exceso vs. mínimo')],
    otra:[T('analyzer.metric.otra.0','Rendimiento directo'),T('analyzer.metric.otra.1','Crecimiento'),T('analyzer.metric.otra.2','Rendimiento esperado'),T('analyzer.metric.otra.3','Ingreso neto'),T('analyzer.metric.otra.4','Horizonte'),T('analyzer.metric.otra.5','Exceso vs. mínimo')]
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
    negocios:[T('analyzer.meaning.negocios.0','<b>Margen neto:</b> utilidad después de costos y gastos.'),T('analyzer.meaning.negocios.1','<b>Flujo de caja:</b> efectivo disponible del proyecto.'),T('analyzer.meaning.negocios.2','<b>ROI:</b> retorno sobre el capital invertido.'),T('analyzer.meaning.negocios.3','<b>Recuperación:</b> tiempo para recuperar el capital.')],
    otra:[T('analyzer.meaning.otra.0','<b>Ingreso anual:</b> dinero generado por el activo.'),T('analyzer.meaning.otra.1','<b>Costos:</b> egresos necesarios para mantenerlo.'),T('analyzer.meaning.otra.2','<b>Rentabilidad:</b> retorno respecto al capital.'),T('analyzer.meaning.otra.3','<b>Tasa de descuento:</b> rendimiento mínimo exigido.')]
  };
  $('meaningList').innerHTML=(texts[type]||texts.otra).map(x=>`<li>${x}</li>`).join('');
}

function renderState(kind){const d=kindData(kind);const card=$('verdictCard'),pill=$('verdict'),why=$('whyCard');card.classList.remove('state-good','state-neutral','state-bad');card.classList.add('state-'+kind);pill.className='verdict-pill '+d.pill;why.classList.remove('state-good','state-neutral','state-bad');why.classList.add('state-'+kind);$('verdictImg').src=`assets/${d.central}`;$('whyImg').src=`assets/${d.img}`;$('verdict').textContent=d.label;$('whyLabel').textContent=d.label;return d}

function calc(){
  if(activeType==='acciones') return calcAcciones();
  if(activeType==='inmuebles') return calcInmuebles();
  if(activeType==='cdt') return calcCDT();
  if(activeType==='etf') return calcETF();
  if(activeType==='negocios') return calcNegocio();
  return calcOtra();
}
function updateDashboard({initial,gain,divs,expected,horizon,points,metrics,reasons,chartGrowth,type}={}){
  const cl=classify(points); renderState(cl.kind);
  $('verdictText').textContent=cl.kind==='good'?T('analyzer.verdict.msg.good','La inversión muestra señales favorables según los supuestos ingresados.'):cl.kind==='neutral'?T('analyzer.verdict.msg.neutral','Hay señales mixtas. Conviene revisar supuestos, riesgos y fuentes antes de sacar conclusiones.'):T('analyzer.verdict.msg.bad','Varios supuestos o indicadores son débiles. Conviene ser prudente y profundizar el análisis.');
  $('scoreValue').textContent=`${cl.score.toFixed(1).replace('.',',')} / ${cl.max}`;
  $('returnPct').textContent=pct(expected); $('gain').textContent=money(gain); $('totalReturn').textContent=pct((initial+gain+divs)/initial-1); $('horizonLabel').textContent=horizon; $('totalYears').textContent=horizon; $('initialText').textContent=money(initial); $('finalText').textContent=money(initial+gain); $('yearsText').textContent=horizon; $('projRate').textContent=pct(expected); $('sInitial').textContent=money(initial); $('sGain').textContent=money(gain); $('sDiv').textContent=money(divs); $('sFinal').textContent=money(initial+gain+divs); $('sTotal').textContent=pct((initial+gain+divs)/initial-1); $('sYears').textContent=horizon;
  const ids=['per','roe','pb','dy','cagr','mos']; metrics.forEach((m,i)=>{ if($(ids[i])) $(ids[i]).textContent=m.value; if($(`${ids[i]}Eval`)) setEval(`${ids[i]}Eval`,m.kind,m.label); });
  $('whyList').innerHTML=reasons.map(x=>`<li>✓ ${x}</li>`).join('');
  const resultTitles={
    acciones:T('analyzer.resulttitle.acciones','Resultados de la acción'),
    inmuebles:T('analyzer.resulttitle.inmuebles','Resultados del inmueble'),
    cdt:T('analyzer.resulttitle.cdt','Resultados del CDT / renta fija'),
    etf:T('analyzer.resulttitle.etf','Resultados del ETF / fondo'),
    negocios:T('analyzer.resulttitle.negocios','Resultados del negocio / proyecto'),
    otra:T('analyzer.resulttitle.otra','Resultados de la inversión')
  };
  $('resultsTitleText').textContent=resultTitles[type]||resultTitles.otra;
  drawChart(initial,chartGrowth,horizon);
}
function calcAcciones(){
  const price=n('price'), shares=Math.max(1,n('shares')), div=n('dividend'), dg=n('divGrowth')/100, growth=n('growth')/100, eps=n('eps'), book=n('book'), disc=n('discount')/100, horizon=Math.max(1,n('horizon'));
  const initial=price*shares, per=eps?price/eps:0, roe=book?eps/book:0, pb=book?price/book:0, dy=price?div/price:0; const fair=(disc>dg&&div)?(div*(1+dg)/(disc-dg)):0; const mos=fair?clamp((fair-price)/fair,0,1):0; const gain=initial*((1+growth)**horizon-1); const divs=dg?div*shares*(((1+dg)**horizon-1)/dg):div*shares*horizon; const expected=dy+growth;
  const arr=[per<10?'good':per<20?'neutral':'bad',roe>.15?'good':roe>.10?'neutral':'bad',pb<1?'good':pb<2?'neutral':'bad',dy>.05?'good':dy>.03?'neutral':'bad',growth>.10?'good':growth>.05?'neutral':'bad',mos>.30?'good':mos>.10?'neutral':'bad'];
  const evalLabel=k=>k==='good'?EVAL_FAV():k==='neutral'?EVAL_NEU():EVAL_UNFAV();
  const points=arr.map(k=>k==='good'?1:k==='neutral'?.5:0); const metrics=[{value:per.toFixed(1).replace('.',','),kind:arr[0],label:evalLabel(arr[0])},{value:pct(roe,0),kind:arr[1],label:evalLabel(arr[1])},{value:pb.toFixed(1).replace('.',','),kind:arr[2],label:evalLabel(arr[2])},{value:pct(dy),kind:arr[3],label:evalLabel(arr[3])},{value:pct(growth),kind:arr[4],label:evalLabel(arr[4])},{value:pct(mos),kind:arr[5],label:evalLabel(arr[5])}];
  const reasons=[]; if(per<10)reasons.push(T('analyzer.reason.acciones.perLow','El PER es bajo frente a este modelo.')); else if(per>=20)reasons.push(T('analyzer.reason.acciones.perHigh','El PER es elevado.')); if(roe>.15)reasons.push(T('analyzer.reason.acciones.roeGood','El ROE muestra buen uso del patrimonio.')); else if(roe<.10)reasons.push(T('analyzer.reason.acciones.roeLow','El ROE es bajo y merece revisión.')); if(dy>.05)reasons.push(T('analyzer.reason.acciones.dyGood','El dividendo representa un rendimiento atractivo.')); if(mos>.10)reasons.push(T('analyzer.reason.acciones.mosGood','El margen de seguridad estimado es {pct}%.').replace('{pct}',Math.round(mos*100))); else reasons.push(T('analyzer.reason.acciones.mosLow','El margen de seguridad es reducido en este escenario.'));
  updateDashboard({initial,gain,divs,expected,horizon,points,metrics,reasons,chartGrowth:growth,type:'acciones'});
}
function calcInmuebles(){
  const price=n('price'), units=Math.max(1,n('shares')), rent=n('dividend'), dg=n('divGrowth')/100, app=n('growth')/100, expenses=n('expenses'), occ=clamp(n('occupancy')/100,0,1), disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=price*units; const netAnnual=Math.max(0,(rent*12*occ-expenses*12))*units; const gross=price?rent*12*occ/price:0; const net=price?netAnnual/initial:0; const gain=initial*((1+app)**horizon-1); const divs=netAnnual*((1+dg)**horizon-1)/(dg||1)*1; const expected=net+app; const payback=netAnnual?initial/netAnnual:Infinity;
  const lab=(good,neutral)=>good?EVAL_FAV():neutral?EVAL_NEU():EVAL_LOW();
  const m=[{value:pct(gross),kind:gross>.07?'good':gross>.045?'neutral':'bad',label:lab(gross>.07,gross>.045)},{value:pct(net),kind:net>.06?'good':net>.04?'neutral':'bad',label:lab(net>.06,net>.04)},{value:pct(app),kind:app>.07?'good':app>.04?'neutral':'bad',label:lab(app>.07,app>.04)},{value:pct(occ),kind:occ>.95?'good':occ>.85?'neutral':'bad',label:lab(occ>.95,occ>.85)},{value:pct(net+app),kind:expected>.12?'good':expected>.08?'neutral':'bad',label:lab(expected>.12,expected>.08)},{value:isFinite(payback)?payback.toFixed(1).replace('.',',')+' '+T('analyzer.unit.years','años'):'—',kind:payback<12?'good':payback<20?'neutral':'bad',label:payback<12?EVAL_FAV():payback<20?EVAL_NEU():EVAL_LONG()}];
  const points=m.map(x=>x.kind==='good'?1:x.kind==='neutral'?.5:0); updateDashboard({initial,gain,divs,expected,horizon,points,metrics:m,reasons:[T('analyzer.reason.inmuebles.net','Rendimiento neto estimado: {v} al año.').replace('{v}',pct(net)),T('analyzer.reason.inmuebles.occ','Ocupación asumida: {v}.').replace('{v}',pct(occ)),T('analyzer.reason.inmuebles.payback','Recuperación simple aproximada: {v} años.').replace('{v}',isFinite(payback)?payback.toFixed(1):'—')],chartGrowth:app,type:'inmuebles'});
}
function calcCDT(){
  const principal=n('price'), rate=n('growth')/100, years=Math.max(.1,n('horizon')), inf=n('inflation')/100, tax=n('tax')/100, disc=n('discount')/100; const initial=principal, gross=principal*((1+rate)**years-1), afterTax=gross*(1-tax), final=principal+afterTax, gain=afterTax, divs=0, expected=years>0?((1+afterTax/principal)**(1/years)-1):0; const real=(1+expected)/(1+inf)-1; const points=[rate>=disc?'good':'neutral',expected>disc?'good':expected>inf?'neutral':'bad',real>.03?'good':real>0?'neutral':'bad',years<=2?'good':years<=4?'neutral':'bad',tax<.1?'good':tax<.15?'neutral':'bad',principal>0?'good':'bad'];
  const P=['analyzer.pill.cdt.0','Tasa'],P1=['analyzer.pill.cdt.1','Rendimiento neto'],P2=['analyzer.pill.cdt.2','Real'],P3=['analyzer.pill.cdt.3','Plazo'],P4=['analyzer.pill.cdt.4','Impuestos'],P5=['analyzer.pill.cdt.5','Exceso vs. tasa mínima'];
  const metrics=[{value:pct(rate),kind:points[0],label:T(...P)},{value:pct(expected),kind:points[1],label:T(...P1)},{value:pct(real),kind:points[2],label:T(...P2)},{value:years.toFixed(1)+' '+T('analyzer.unit.years','años'),kind:points[3],label:T(...P3)},{value:pct(tax),kind:points[4],label:T(...P4)},{value:pct(Math.max(0,expected-disc)),kind:points[5],label:T(...P5)}]; updateDashboard({initial,gain,divs,expected,horizon:years,points:points.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.cdt.gain','Ganancia estimada después de retención: {v}.').replace('{v}',money(gain)),T('analyzer.reason.cdt.real','Rendimiento real frente a inflación: {v}.').replace('{v}',pct(real)),T('analyzer.reason.cdt.term','El plazo es de {v} años.').replace('{v}',years)],chartGrowth:expected,type:'cdt'});
}
function calcETF(){
  const price=n('price'), shares=Math.max(1,n('shares')), div=n('dividend'), growth=n('growth')/100, dg=n('divGrowth')/100, ter=n('expensesRate')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=price*shares; const netGrowth=growth-ter; const gain=initial*((1+Math.max(-.99,netGrowth))**horizon-1); const dy=price?div/price:0; const divs=dg?div*shares*(((1+dg)**horizon-1)/dg):div*shares*horizon; const expected=dy+netGrowth; const pts=[netGrowth>.08?'good':netGrowth>.04?'neutral':'bad',dy>.03?'good':dy>.015?'neutral':'bad',ter<.003?'good':ter<.008?'neutral':'bad',expected>disc?'good':expected>disc-.02?'neutral':'bad',horizon>=5?'good':horizon>=3?'neutral':'bad',shares>0?'good':'bad'];
  const metrics=[{value:pct(netGrowth),kind:pts[0],label:T('analyzer.pill.etf.0','Neto')},{value:pct(dy),kind:pts[1],label:T('analyzer.pill.etf.1','Favorable')},{value:pct(ter),kind:pts[2],label:T('analyzer.pill.etf.2','Bajo costo')},{value:pct(expected),kind:pts[3],label:T('analyzer.pill.etf.3','Esperado')},{value:horizon+' '+T('analyzer.unit.years','años'),kind:pts[4],label:T('analyzer.pill.etf.4','Horizonte')},{value:pct(Math.max(0,expected-disc)),kind:pts[5],label:T('analyzer.pill.etf.5','Vs. mínimo')}]; updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.etf.growth','Crecimiento neto estimado después de TER: {v}.').replace('{v}',pct(netGrowth)),T('analyzer.reason.etf.dy','Dividend Yield estimado: {v}.').replace('{v}',pct(dy)),T('analyzer.reason.etf.cost','Costo anual del fondo: {v}.').replace('{v}',pct(ter))],chartGrowth:netGrowth,type:'etf'});
}
function calcNegocio(){
  const inv=n('price'), units=Math.max(1,n('shares')), revenue=n('revenue'), margin=n('margin')/100, growth=n('growth')/100, expenses=n('expenses'), disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=inv*units, profit=Math.max(0,revenue*margin-expenses)*units, gain=profit*((1+growth)**horizon-1), divs=profit*0.6*((1+growth)**horizon-1)/(growth||1), expected=initial?profit/initial+growth:0, roi=initial?profit/initial:0, payback=profit?initial/profit:Infinity; const pts=[roi>.20?'good':roi>.10?'neutral':'bad',margin>.25?'good':margin>.12?'neutral':'bad',growth>.10?'good':growth>.05?'neutral':'bad',expected>disc?'good':expected>disc-.02?'neutral':'bad',payback<5?'good':payback<8?'neutral':'bad',profit>0?'good':'bad'];
  const metrics=[{value:pct(roi),kind:pts[0],label:T('analyzer.pill.negocios.0','ROI')},{value:pct(margin),kind:pts[1],label:T('analyzer.pill.negocios.1','Margen')},{value:pct(growth),kind:pts[2],label:T('analyzer.pill.negocios.2','Crecimiento')},{value:pct(expected),kind:pts[3],label:T('analyzer.pill.negocios.3','Esperado')},{value:isFinite(payback)?payback.toFixed(1).replace('.',',')+' '+T('analyzer.unit.years','años'):'—',kind:pts[4],label:T('analyzer.pill.negocios.4','Recuperación')},{value:pct(Math.max(0,expected-disc)),kind:pts[5],label:T('analyzer.pill.negocios.5','Vs. mínimo')}]; updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.negocios.profit','Utilidad anual estimada: {v}.').replace('{v}',money(profit)),T('analyzer.reason.negocios.roi','ROI simple estimado: {v}.').replace('{v}',pct(roi)),T('analyzer.reason.negocios.payback','Recuperación aproximada: {v} años.').replace('{v}',isFinite(payback)?payback.toFixed(1):'—')],chartGrowth:growth,type:'negocios'});
}
function calcOtra(){
  const initial=n('price')*Math.max(1,n('shares')), income=n('dividend'), costs=n('expenses'), growth=n('growth')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const net=Math.max(0,income-costs), ret=initial?net/initial:0, gain=initial*((1+growth)**horizon-1), divs=net*horizon, expected=ret+growth; const pts=[ret>.12?'good':ret>.06?'neutral':'bad',growth>.10?'good':growth>.05?'neutral':'bad',expected>disc?'good':expected>disc-.02?'neutral':'bad',net>0?'good':'bad',horizon>=5?'good':'neutral',initial>0?'good':'bad'];
  const metrics=[{value:pct(ret),kind:pts[0],label:T('analyzer.pill.otra.0','Rendimiento')},{value:pct(growth),kind:pts[1],label:T('analyzer.pill.otra.1','Crecimiento')},{value:pct(expected),kind:pts[2],label:T('analyzer.pill.otra.2','Esperado')},{value:money(net),kind:pts[3],label:T('analyzer.pill.otra.3','Neto anual')},{value:horizon+' '+T('analyzer.unit.years','años'),kind:pts[4],label:T('analyzer.pill.otra.4','Horizonte')},{value:pct(Math.max(0,expected-disc)),kind:pts[5],label:T('analyzer.pill.otra.5','Vs. mínimo')}]; updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[T('analyzer.reason.otra.income','Ingreso neto anual estimado: {v}.').replace('{v}',money(net)),T('analyzer.reason.otra.ret','Rentabilidad directa estimada: {v}.').replace('{v}',pct(ret)),T('analyzer.reason.otra.growth','Crecimiento supuesto: {v}.').replace('{v}',pct(growth))],chartGrowth:growth,type:'otra'});
}

function drawChart(initial,growth,horizon){const c=$('chart'); if(!c)return; const ctx=c.getContext('2d'),w=c.clientWidth||670,h=215,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const vals=[];for(let i=0;i<=Math.min(Math.ceil(horizon),8);i++)vals.push(initial*Math.pow(1+growth,i));const max=Math.max(...vals)*1.1,pad={l:52,r:15,t:16,b:32},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;ctx.strokeStyle=document.body.classList.contains('dark')?'#334b4b':'#cdd7d0';ctx.font='10px Segoe UI';ctx.fillStyle=document.body.classList.contains('dark')?'#b9cbc5':'#52645e';ctx.textAlign='right';for(let j=0;j<=4;j++){const y=pad.t+ch*j/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(money((max-(max)*j/4)/1),pad.l-6,y+3)}const bw=cw/vals.length*.55;ctx.textAlign='center';const todayLabel=T('analyzer.chart.today','Hoy'),ySing=T('analyzer.chart.year.singular','año'),yPlur=T('analyzer.chart.year.plural','años');for(let i=0;i<vals.length;i++){const x=pad.l+cw*(i+.5)/vals.length,bh=vals[i]/max*ch,y=pad.t+ch-bh;ctx.fillStyle='#8bc53f';ctx.fillRect(x-bw/2,y,bw,bh);ctx.fillStyle=document.body.classList.contains('dark')?'#d9ecba':'#315a35';ctx.font='bold 10px Segoe UI';ctx.fillText(money(vals[i]),x,y-6);ctx.fillStyle=document.body.classList.contains('dark')?'#b9cbc5':'#52645e';ctx.font='10px Segoe UI';ctx.fillText(i===0?todayLabel:`${i} ${i!==1?yPlur:ySing}`,x,h-8)}}

function nav(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));const target=$(`page-${page}`);if(target)target.classList.add('active-page');document.querySelectorAll('.side-item').forEach(b=>b.classList.remove('selected'));document.querySelectorAll(`[data-page="${page}"]`).forEach(b=>b.classList.add('selected'));if(page==='comparar'&&!$('compareGrid').dataset.ready)buildCompare();if(page==='glosario')buildGlossary($('glossarySearch')?.value||'');if(page==='aprende')return;}
function selectAnalysisType(type){document.querySelectorAll('.analysis-type').forEach(b=>b.classList.toggle('selected',b.dataset.analysisType===type));nav('analiza');setAnalysisForm(type)}
function buildCompare(){const g=$('compareGrid');const invLabel=T('analyzer.compare.cardtitle','Inversión');const defNames=[T('analyzer.compare.default.acciones','Ecopetrol'),T('analyzer.compare.default.cdt','CDT'),T('analyzer.compare.default.etf','ETF')];g.innerHTML=['A','B','C'].map((x,i)=>`<div class="compare-card"><h3>${invLabel} ${x}</h3><label>${T('analyzer.compare.name','Nombre')} <input data-cmp="name${i}" value="${defNames[i]||''}"></label><label>${T('analyzer.compare.return','Rentabilidad anual')} <input data-cmp="ret${i}" type="number" value="${i===0?13.8:i===1?9:11}" step="0.1">%</label><label>${T('analyzer.compare.risk','Riesgo (1-10)')} <input data-cmp="risk${i}" type="number" min="1" max="10" value="${i+3}"></label><label>${T('analyzer.compare.liquidity','Liquidez (1-10)')} <input data-cmp="liq${i}" type="number" min="1" max="10" value="${10-i*2}"></label><label>${T('analyzer.compare.horizon','Horizonte (años)')} <input data-cmp="hor${i}" type="number" min="1" value="5"></label><div class="compare-result"><span class="state-chip chip-neutral" data-cmpout="${i}">${T('analyzer.kind.neutral','REGULAR')}</span><b data-cmpscore="${i}">${T('analyzer.compare.score','Puntaje')} 0/100</b></div></div>`).join('');g.dataset.ready='1';g.querySelectorAll('input').forEach(i=>i.addEventListener('input',scoreCompare));scoreCompare()}
function scoreCompare(){document.querySelectorAll('.compare-card').forEach((c,i)=>{const ret=parseFloat(c.querySelector(`[data-cmp="ret${i}"]`).value)||0,risk=parseFloat(c.querySelector(`[data-cmp="risk${i}"]`).value)||5,liq=parseFloat(c.querySelector(`[data-cmp="liq${i}"]`).value)||5;const s=clamp(ret*4+(10-risk)*4+liq*2,0,100),kind=s>=70?'good':s>=50?'neutral':'bad',d=kindData(kind),chip=c.querySelector(`[data-cmpout="${i}"]`);chip.className=`state-chip chip-${kind}`;chip.textContent=d.label;c.querySelector(`[data-cmpscore="${i}"]`).textContent=`${T('analyzer.compare.score','Puntaje')} ${Math.round(s)}/100`})}
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
    negocios:{title:T('analyzer.type.negocios.title','Negocios / Proyectos'),icon:'💼',subtitle:T('analyzer.type.negocios.subtitle','Evalúa retorno, margen, crecimiento, recuperación de la inversión y riesgo del proyecto.')},
    otra:{title:T('analyzer.type.otra.title','Otra inversión'),icon:'🧩',subtitle:T('analyzer.type.otra.subtitle','Usa un modelo general para estudiar inversiones que no encajan en las categorías anteriores.')}
  });
  setAnalysisForm(activeType);
  if($('compareGrid')?.dataset.ready) buildCompare();
  buildGlossary($('glossarySearch')?.value||'');
  calcWhatIf();
}
document.addEventListener('mm:lang-changed', refreshDynamicContent);

function wire(){
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.analysisType) selectAnalysisType(b.dataset.analysisType); else nav(b.dataset.page); }));
  $('glossarySearch')?.addEventListener('input',e=>buildGlossary(e.target.value));
  $('loanNo').onclick=()=>{$('loanNo').classList.add('active');$('loanYes').classList.remove('active')}; $('loanYes').onclick=()=>{$('loanYes').classList.add('active');$('loanNo').classList.remove('active')};
  $('appName').addEventListener('input',e=>{document.querySelector('.title').textContent=e.target.value;document.title=e.target.value;localStorage.setItem('mm_app_name',e.target.value)});
  const savedName=localStorage.getItem('mm_app_name');if(savedName){$('appName').value=savedName;document.querySelector('.title').textContent=savedName;document.title=savedName}
  $('currency').value=currentCurrency; $('currency').addEventListener('change',e=>{currentCurrency=e.target.value;localStorage.setItem('mm_currency',currentCurrency);calc();calcWhatIf();});
  $('darkMode').addEventListener('change',e=>{document.body.classList.toggle('dark',e.target.checked);localStorage.setItem('mm_dark',e.target.checked?'1':'0');calc();});
  $('showWarnings').addEventListener('change',e=>document.querySelector('.warning').style.display=e.target.checked?'block':'none');
  window.addEventListener('resize',calc);
  setupDark(); setupMobileMenu(); selectAnalysisType('acciones'); calcWhatIf(); buildGlossary('');
}
wire();

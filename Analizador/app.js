const $ = id => document.getElementById(id);
const n = id => parseFloat($(id)?.value) || 0;
let activeType = 'acciones';
let currentCurrency = localStorage.getItem('mm_currency') || 'COP';
const currencyFmt = new Intl.NumberFormat('es-CO');

const TYPE = {
  acciones:{title:'Acciones',icon:'📈',subtitle:'Analiza una empresa y sus indicadores de valoración, rentabilidad y crecimiento.'},
  inmuebles:{title:'Inmuebles',icon:'🏠',subtitle:'Estudia precio, renta, gastos, ocupación, valorización y rendimiento del inmueble.'},
  cdt:{title:'CDT / Renta fija',icon:'🏦',subtitle:'Calcula rendimiento de un CDT o instrumento de renta fija considerando plazo y tasa.'},
  etf:{title:'ETF / Fondos',icon:'📊',subtitle:'Analiza costos, dividendos, crecimiento esperado y rendimiento de un ETF o fondo.'},
  negocios:{title:'Negocios / Proyectos',icon:'💼',subtitle:'Evalúa retorno, margen, crecimiento, recuperación de la inversión y riesgo del proyecto.'},
  otra:{title:'Otra inversión',icon:'🧩',subtitle:'Usa un modelo general para estudiar inversiones que no encajan en las categorías anteriores.'}
};

function money(v){
  const s = currencyFmt.format(Math.round(v));
  const sym = {COP:'$ ',USD:'US$ ',EUR:'€ '}[currentCurrency] || '$ ';
  return sym+s;
}
function pct(v,dec=1){return (v*100).toFixed(dec).replace('.',',')+'%'}
function kindData(kind){return {good:{label:'BUENA',img:'good.png',central:'central_good.png',pill:'verdict-good'},neutral:{label:'REGULAR',img:'neutral.png',central:'neutral.png',pill:'verdict-neutral'},bad:{label:'MALA',img:'bad.png',central:'bad.png',pill:'verdict-bad'}}[kind]}
function setEval(elId,kind,label){const d=kindData(kind);const el=$(elId);if(!el)return;el.innerHTML=`<span class="eval ${kind==='neutral'?'reg':kind}"><img src="assets/${d.img}">${label}</span>`}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function classify(points){const score=points.reduce((a,b)=>a+b,0), max=points.length; const ratio=score/max; return {score,max,kind:ratio>=.67?'good':ratio>=.42?'neutral':'bad'};}

function setAnalysisForm(type){
  activeType=type;
  const c=TYPE[type];
  $('analysisTitle').textContent=c.title; $('analysisIcon').textContent=c.icon; $('analysisSubtitle').textContent=c.subtitle;
  const g=$('analysisFormGrid');
  const templates={
    acciones:[
      ['Nombre de la acción','text','name','Ecopetrol (ECOPETROL)'],['Precio actual por acción','number','price','1950'],['Número de acciones que comprarás','number','shares','1000'],['Dividendo anual por acción','number','dividend','120'],['Crecimiento esperado del dividendo (%)','number','divGrowth','5'],['Crecimiento esperado de la empresa (%)','number','growth','8'],['Utilidad por acción (EPS)','number','eps','240'],['Valor en libros por acción','number','book','1000'],['Tasa de descuento / costo de oportunidad (%)','number','discount','10'],['Horizonte de inversión (años)','number','horizon','5']
    ],
    inmuebles:[
      ['Nombre del inmueble','text','name','Apartamento / Local'],['Precio de compra','number','price','300000000'],['Cantidad de inmuebles','number','shares','1'],['Arriendo mensual esperado','number','dividend','1800000'],['Crecimiento anual del arriendo (%)','number','divGrowth','4'],['Valorización esperada anual (%)','number','growth','6'],['Gastos mensuales','number','expenses','350000'],['Ocupación esperada (%)','number','occupancy','95'],['Tasa de descuento (%)','number','discount','10'],['Horizonte (años)','number','horizon','10']
    ],
    cdt:[
      ['Nombre del producto','text','name','CDT a 1 año'],['Capital inicial','number','price','10000000'],['Unidades / cuentas','number','shares','1'],['Tasa efectiva anual (%)','number','growth','9'],['Plazo (años)','number','horizon','1'],['Inflación esperada (%)','number','inflation','5'],['Retención / impuestos (%)','number','tax','4'],['Tasa mínima exigida (%)','number','discount','8']
    ],
    etf:[
      ['Nombre del ETF / fondo','text','name','ETF global'],['Precio actual por participación','number','price','400'],['Participaciones','number','shares','25'],['Dividendos anuales por participación','number','dividend','6'],['Crecimiento esperado (%)','number','growth','7'],['Crecimiento del dividendo (%)','number','divGrowth','4'],['Gastos del fondo / TER (%)','number','expensesRate','0.2'],['Tasa de descuento (%)','number','discount','9'],['Horizonte (años)','number','horizon','5']
    ],
    negocios:[
      ['Nombre del proyecto','text','name','Negocio / Proyecto'],['Inversión inicial','number','price','50000000'],['Unidades / proyectos','number','shares','1'],['Ingresos anuales esperados','number','revenue','30000000'],['Margen neto esperado (%)','number','margin','20'],['Crecimiento anual (%)','number','growth','8'],['Gasto / inversión adicional anual','number','expenses','3000000'],['Tasa de descuento (%)','number','discount','12'],['Horizonte (años)','number','horizon','5']
    ],
    otra:[
      ['Nombre de la inversión','text','name','Mi inversión'],['Capital inicial','number','price','10000000'],['Unidades / participaciones','number','shares','1'],['Ingreso o rendimiento anual','number','dividend','800000'],['Crecimiento esperado (%)','number','growth','7'],['Crecimiento del ingreso (%)','number','divGrowth','3'],['Costos anuales','number','expenses','100000'],['Tasa de descuento (%)','number','discount','10'],['Horizonte (años)','number','horizon','5']
    ]
  };
  const rows=templates[type];
  g.innerHTML=rows.map(r=>{
    const [label,kind,id,val]=r;
    const cls=kind==='number'?'number-input':'';
    return `<label>${label}</label><input class="${cls}" id="${id}" type="${kind}" value="${val}" step="any">`;
  }).join('');
  // Loan section is meaningful for all categories
  const formIds=rows.map(r=>r[2]);
  formIds.forEach(id=>$(id)?.addEventListener('input',calc));
  updateMeaning(type);
  const metricNames={
    acciones:['PER <small>(Price to Earnings)</small>','ROE <small>(Return on Equity)</small>','P/B <small>(Price to Book)</small>','Dividend Yield','CAGR <small>(Crecimiento anual)</small>','Margen de seguridad'],
    inmuebles:['Rendimiento bruto','Rendimiento neto','Valorización anual','Ocupación','Retorno esperado','Recuperación'],
    cdt:['Tasa efectiva anual','Rendimiento neto','Rendimiento real','Plazo','Retención / impuestos','Exceso vs. tasa mínima'],
    etf:['Crecimiento neto','Dividend Yield','TER <small>(costo del fondo)</small>','Rendimiento esperado','Horizonte','Exceso vs. mínimo'],
    negocios:['ROI','Margen neto','Crecimiento','Rendimiento esperado','Recuperación','Exceso vs. mínimo'],
    otra:['Rendimiento directo','Crecimiento','Rendimiento esperado','Ingreso neto','Horizonte','Exceso vs. mínimo']
  }[type];
  metricNames.forEach((v,i)=>{if($(`metricName${i}`)) $(`metricName${i}`).innerHTML=v;});
  calc();
}
function updateMeaning(type){
  const texts={
    acciones:['<b>EPS:</b> ganancia por acción.','<b>PER:</b> relación entre precio y ganancias.','<b>ROE:</b> rentabilidad sobre el patrimonio.','<b>P/B:</b> precio frente a valor en libros.','<b>Dividend Yield:</b> rendimiento del dividendo.'],
    inmuebles:['<b>Rendimiento bruto:</b> arriendo anual frente al precio.','<b>Rendimiento neto:</b> descuenta gastos y vacancia.','<b>Valorización:</b> crecimiento esperado del valor del inmueble.','<b>Ocupación:</b> porcentaje de tiempo con ingreso de renta.'],
    cdt:['<b>TEA:</b> tasa efectiva anual ofrecida.','<b>Inflación:</b> pérdida esperada de poder adquisitivo.','<b>Retención:</b> impuesto o retención aplicada al rendimiento.','<b>Rendimiento real:</b> retorno después de inflación.'],
    etf:['<b>TER:</b> costo anual del fondo.','<b>Dividend Yield:</b> ingreso distribuido frente al precio.','<b>Crecimiento:</b> apreciación esperada del fondo.','<b>Diversificación:</b> distribuir exposición entre múltiples activos.'],
    negocios:['<b>Margen neto:</b> utilidad después de costos y gastos.','<b>Flujo de caja:</b> efectivo disponible del proyecto.','<b>ROI:</b> retorno sobre el capital invertido.','<b>Recuperación:</b> tiempo para recuperar el capital.'],
    otra:['<b>Ingreso anual:</b> dinero generado por el activo.','<b>Costos:</b> egresos necesarios para mantenerlo.','<b>Rentabilidad:</b> retorno respecto al capital.','<b>Tasa de descuento:</b> rendimiento mínimo exigido.']
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
function updateDashboard({initial,gain,divs,expected,horizon,points,metrics,reasons,chartGrowth,title}={}){
  const cl=classify(points); renderState(cl.kind);
  $('verdictText').textContent=cl.kind==='good'?'La inversión muestra señales favorables según los supuestos ingresados.':cl.kind==='neutral'?'Hay señales mixtas. Conviene revisar supuestos, riesgos y fuentes antes de sacar conclusiones.':'Varios supuestos o indicadores son débiles. Conviene ser prudente y profundizar el análisis.';
  $('scoreValue').textContent=`${cl.score.toFixed(1).replace('.',',')} / ${cl.max}`;
  $('returnPct').textContent=pct(expected); $('gain').textContent=money(gain); $('totalReturn').textContent=pct((initial+gain+divs)/initial-1); $('horizonLabel').textContent=horizon; $('totalYears').textContent=horizon; $('initialText').textContent=money(initial); $('finalText').textContent=money(initial+gain); $('yearsText').textContent=horizon; $('projRate').textContent=pct(expected); $('sInitial').textContent=money(initial); $('sGain').textContent=money(gain); $('sDiv').textContent=money(divs); $('sFinal').textContent=money(initial+gain+divs); $('sTotal').textContent=pct((initial+gain+divs)/initial-1); $('sYears').textContent=horizon;
  const ids=['per','roe','pb','dy','cagr','mos']; metrics.forEach((m,i)=>{ if($(ids[i])) $(ids[i]).textContent=m.value; if($(`${ids[i]}Eval`)) setEval(`${ids[i]}Eval`,m.kind,m.label); });
  $('whyList').innerHTML=reasons.map(x=>`<li>✓ ${x}</li>`).join('');
  $('resultsTitleText').textContent=title?`Resultados de ${title.toLowerCase()}`:'Resultados de la inversión';
  drawChart(initial,chartGrowth,horizon);
}
function calcAcciones(){
  const price=n('price'), shares=Math.max(1,n('shares')), div=n('dividend'), dg=n('divGrowth')/100, growth=n('growth')/100, eps=n('eps'), book=n('book'), disc=n('discount')/100, horizon=Math.max(1,n('horizon'));
  const initial=price*shares, per=eps?price/eps:0, roe=book?eps/book:0, pb=book?price/book:0, dy=price?div/price:0; const fair=(disc>dg&&div)?(div*(1+dg)/(disc-dg)):0; const mos=fair?clamp((fair-price)/fair,0,1):0; const gain=initial*((1+growth)**horizon-1); const divs=dg?div*shares*(((1+dg)**horizon-1)/dg):div*shares*horizon; const expected=dy+growth;
  const arr=[per<10?'good':per<20?'neutral':'bad',roe>.15?'good':roe>.10?'neutral':'bad',pb<1?'good':pb<2?'neutral':'bad',dy>.05?'good':dy>.03?'neutral':'bad',growth>.10?'good':growth>.05?'neutral':'bad',mos>.30?'good':mos>.10?'neutral':'bad'];
  const points=arr.map(k=>k==='good'?1:k==='neutral'?.5:0); const metrics=[{value:per.toFixed(1).replace('.',','),kind:arr[0],label:arr[0]==='good'?'Favorable':arr[0]==='neutral'?'Neutral':'Desfavorable'},{value:pct(roe,0),kind:arr[1],label:arr[1]==='good'?'Favorable':arr[1]==='neutral'?'Neutral':'Desfavorable'},{value:pb.toFixed(1).replace('.',','),kind:arr[2],label:arr[2]==='good'?'Favorable':arr[2]==='neutral'?'Neutral':'Desfavorable'},{value:pct(dy),kind:arr[3],label:arr[3]==='good'?'Favorable':arr[3]==='neutral'?'Neutral':'Desfavorable'},{value:pct(growth),kind:arr[4],label:arr[4]==='good'?'Favorable':arr[4]==='neutral'?'Neutral':'Desfavorable'},{value:pct(mos),kind:arr[5],label:arr[5]==='good'?'Favorable':arr[5]==='neutral'?'Neutral':'Desfavorable'}];
  const reasons=[]; if(per<10)reasons.push('El PER es bajo frente a este modelo.'); else if(per>=20)reasons.push('El PER es elevado.'); if(roe>.15)reasons.push('El ROE muestra buen uso del patrimonio.'); else if(roe<.10)reasons.push('El ROE es bajo y merece revisión.'); if(dy>.05)reasons.push('El dividendo representa un rendimiento atractivo.'); if(mos>.10)reasons.push(`El margen de seguridad estimado es ${Math.round(mos*100)}%.`); else reasons.push('El margen de seguridad es reducido en este escenario.');
  updateDashboard({initial,gain,divs,expected,horizon,points,metrics,reasons,chartGrowth:growth,title:'la acción'});
}
function calcInmuebles(){
  const price=n('price'), units=Math.max(1,n('shares')), rent=n('dividend'), dg=n('divGrowth')/100, app=n('growth')/100, expenses=n('expenses'), occ=clamp(n('occupancy')/100,0,1), disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=price*units; const netAnnual=Math.max(0,(rent*12*occ-expenses*12))*units; const gross=price?rent*12*occ/price:0; const net=price?netAnnual/initial:0; const gain=initial*((1+app)**horizon-1); const divs=netAnnual*((1+dg)**horizon-1)/(dg||1)*1; const expected=net+app; const payback=netAnnual?initial/netAnnual:Infinity; const m=[{value:pct(gross),kind:gross>.07?'good':gross>.045?'neutral':'bad',label:gross>.07?'Favorable':gross>.045?'Neutral':'Baja'},{value:pct(net),kind:net>.06?'good':net>.04?'neutral':'bad',label:net>.06?'Favorable':net>.04?'Neutral':'Baja'},{value:pct(app),kind:app>.07?'good':app>.04?'neutral':'bad',label:app>.07?'Favorable':app>.04?'Neutral':'Baja'},{value:pct(occ),kind:occ>.95?'good':occ>.85?'neutral':'bad',label:occ>.95?'Favorable':occ>.85?'Neutral':'Baja'},{value:pct(net+app),kind:expected>.12?'good':expected>.08?'neutral':'bad',label:expected>.12?'Favorable':expected>.08?'Neutral':'Baja'},{value:isFinite(payback)?payback.toFixed(1).replace('.',',')+' años':'—',kind:payback<12?'good':payback<20?'neutral':'bad',label:payback<12?'Favorable':payback<20?'Neutral':'Largo'}];
  const points=m.map(x=>x.kind==='good'?1:x.kind==='neutral'?.5:0); updateDashboard({initial,gain,divs,expected,horizon,points,metrics:m,reasons:[`Rendimiento neto estimado: ${pct(net)} al año.`,`Ocupación asumida: ${pct(occ)}.`,`Recuperación simple aproximada: ${isFinite(payback)?payback.toFixed(1):'—'} años.`],chartGrowth:app,title:'el inmueble'});
}
function calcCDT(){
  const principal=n('price'), rate=n('growth')/100, years=Math.max(.1,n('horizon')), inf=n('inflation')/100, tax=n('tax')/100, disc=n('discount')/100; const initial=principal, gross=principal*((1+rate)**years-1), afterTax=gross*(1-tax), final=principal+afterTax, gain=afterTax, divs=0, expected=years>0?((1+afterTax/principal)**(1/years)-1):0; const real=(1+expected)/(1+inf)-1; const points=[rate>=disc?'good':'neutral',expected>disc?'good':expected>inf?'neutral':'bad',real>.03?'good':real>0?'neutral':'bad',years<=2?'good':years<=4?'neutral':'bad',tax<.1?'good':tax<.15?'neutral':'bad',principal>0?'good':'bad']; const metrics=[{value:pct(rate),kind:points[0],label:'Tasa'},{value:pct(expected),kind:points[1],label:'Rendimiento neto'},{value:pct(real),kind:points[2],label:'Real'},{value:years.toFixed(1)+' años',kind:points[3],label:'Plazo'},{value:pct(tax),kind:points[4],label:'Impuestos'},{value:pct(Math.max(0,expected-disc)),kind:points[5],label:'Exceso vs. tasa mínima'}]; updateDashboard({initial,gain,divs,expected,horizon:years,points:points.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[`Ganancia estimada después de retención: ${money(gain)}.`,`Rendimiento real frente a inflación: ${pct(real)}.`,`El plazo es de ${years} años.`],chartGrowth:expected,title:'el CDT / renta fija'});
}
function calcETF(){
  const price=n('price'), shares=Math.max(1,n('shares')), div=n('dividend'), growth=n('growth')/100, dg=n('divGrowth')/100, ter=n('expensesRate')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=price*shares; const netGrowth=growth-ter; const gain=initial*((1+Math.max(-.99,netGrowth))**horizon-1); const dy=price?div/price:0; const divs=dg?div*shares*(((1+dg)**horizon-1)/dg):div*shares*horizon; const expected=dy+netGrowth; const pts=[netGrowth>.08?'good':netGrowth>.04?'neutral':'bad',dy>.03?'good':dy>.015?'neutral':'bad',ter<.003?'good':ter<.008?'neutral':'bad',expected>disc?'good':expected>disc-.02?'neutral':'bad',horizon>=5?'good':horizon>=3?'neutral':'bad',shares>0?'good':'bad']; const metrics=[{value:pct(netGrowth),kind:pts[0],label:'Neto'},{value:pct(dy),kind:pts[1],label:'Favorable'},{value:pct(ter),kind:pts[2],label:'Bajo costo'},{value:pct(expected),kind:pts[3],label:'Esperado'},{value:horizon+' años',kind:pts[4],label:'Horizonte'},{value:pct(Math.max(0,expected-disc)),kind:pts[5],label:'Vs. mínimo'}]; updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[`Crecimiento neto estimado después de TER: ${pct(netGrowth)}.`,`Dividend Yield estimado: ${pct(dy)}.`,`Costo anual del fondo: ${pct(ter)}.`],chartGrowth:netGrowth,title:'el ETF / fondo'});
}
function calcNegocio(){
  const inv=n('price'), units=Math.max(1,n('shares')), revenue=n('revenue'), margin=n('margin')/100, growth=n('growth')/100, expenses=n('expenses'), disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const initial=inv*units, profit=Math.max(0,revenue*margin-expenses)*units, gain=profit*((1+growth)**horizon-1), divs=profit*0.6*((1+growth)**horizon-1)/(growth||1), expected=initial?profit/initial+growth:0, roi=initial?profit/initial:0, payback=profit?initial/profit:Infinity; const pts=[roi>.20?'good':roi>.10?'neutral':'bad',margin>.25?'good':margin>.12?'neutral':'bad',growth>.10?'good':growth>.05?'neutral':'bad',expected>disc?'good':expected>disc-.02?'neutral':'bad',payback<5?'good':payback<8?'neutral':'bad',profit>0?'good':'bad']; const metrics=[{value:pct(roi),kind:pts[0],label:'ROI'},{value:pct(margin),kind:pts[1],label:'Margen'},{value:pct(growth),kind:pts[2],label:'Crecimiento'},{value:pct(expected),kind:pts[3],label:'Esperado'},{value:isFinite(payback)?payback.toFixed(1).replace('.',',')+' años':'—',kind:pts[4],label:'Recuperación'},{value:pct(Math.max(0,expected-disc)),kind:pts[5],label:'Vs. mínimo'}]; updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[`Utilidad anual estimada: ${money(profit)}.`,`ROI simple estimado: ${pct(roi)}.`,`Recuperación aproximada: ${isFinite(payback)?payback.toFixed(1):'—'} años.`],chartGrowth:growth,title:'el negocio / proyecto'});
}
function calcOtra(){
  const initial=n('price')*Math.max(1,n('shares')), income=n('dividend'), costs=n('expenses'), growth=n('growth')/100, disc=n('discount')/100, horizon=Math.max(1,n('horizon')); const net=Math.max(0,income-costs), ret=initial?net/initial:0, gain=initial*((1+growth)**horizon-1), divs=net*horizon, expected=ret+growth; const pts=[ret>.12?'good':ret>.06?'neutral':'bad',growth>.10?'good':growth>.05?'neutral':'bad',expected>disc?'good':expected>disc-.02?'neutral':'bad',net>0?'good':'bad',horizon>=5?'good':'neutral',initial>0?'good':'bad']; const metrics=[{value:pct(ret),kind:pts[0],label:'Rendimiento'},{value:pct(growth),kind:pts[1],label:'Crecimiento'},{value:pct(expected),kind:pts[2],label:'Esperado'},{value:money(net),kind:pts[3],label:'Neto anual'},{value:horizon+' años',kind:pts[4],label:'Horizonte'},{value:pct(Math.max(0,expected-disc)),kind:pts[5],label:'Vs. mínimo'}]; updateDashboard({initial,gain,divs,expected,horizon,points:pts.map(k=>k==='good'?1:k==='neutral'?.5:0),metrics,reasons:[`Ingreso neto anual estimado: ${money(net)}.`,`Rentabilidad directa estimada: ${pct(ret)}.`,`Crecimiento supuesto: ${pct(growth)}.`],chartGrowth:growth,title:'la inversión'});
}

function drawChart(initial,growth,horizon){const c=$('chart'); if(!c)return; const ctx=c.getContext('2d'),w=c.clientWidth||670,h=215,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const vals=[];for(let i=0;i<=Math.min(Math.ceil(horizon),8);i++)vals.push(initial*Math.pow(1+growth,i));const max=Math.max(...vals)*1.1,pad={l:52,r:15,t:16,b:32},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;ctx.strokeStyle=document.body.classList.contains('dark')?'#334b4b':'#cdd7d0';ctx.font='10px Segoe UI';ctx.fillStyle=document.body.classList.contains('dark')?'#b9cbc5':'#52645e';ctx.textAlign='right';for(let j=0;j<=4;j++){const y=pad.t+ch*j/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(money((max-(max)*j/4)/1),pad.l-6,y+3)}const bw=cw/vals.length*.55;ctx.textAlign='center';for(let i=0;i<vals.length;i++){const x=pad.l+cw*(i+.5)/vals.length,bh=vals[i]/max*ch,y=pad.t+ch-bh;ctx.fillStyle='#8bc53f';ctx.fillRect(x-bw/2,y,bw,bh);ctx.fillStyle=document.body.classList.contains('dark')?'#d9ecba':'#315a35';ctx.font='bold 10px Segoe UI';ctx.fillText(money(vals[i]),x,y-6);ctx.fillStyle=document.body.classList.contains('dark')?'#b9cbc5':'#52645e';ctx.font='10px Segoe UI';ctx.fillText(i===0?'Hoy':`${i} año${i!==1?'s':''}`,x,h-8)}}

function nav(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));const target=$(`page-${page}`);if(target)target.classList.add('active-page');document.querySelectorAll('.side-item').forEach(b=>b.classList.remove('selected'));document.querySelectorAll(`[data-page="${page}"]`).forEach(b=>b.classList.add('selected'));if(page==='comparar'&&!$('compareGrid').dataset.ready)buildCompare();if(page==='glosario')buildGlossary($('glossarySearch')?.value||'');if(page==='aprende')return;}
function selectAnalysisType(type){document.querySelectorAll('.analysis-type').forEach(b=>b.classList.toggle('selected',b.dataset.analysisType===type));nav('analiza');setAnalysisForm(type)}
function buildCompare(){const g=$('compareGrid');g.innerHTML=['A','B','C'].map((x,i)=>`<div class="compare-card"><h3>Inversión ${x}</h3><label>Nombre <input data-cmp="name${i}" value="${i===0?'Ecopetrol':i===1?'CDT':'ETF'}"></label><label>Rentabilidad anual <input data-cmp="ret${i}" type="number" value="${i===0?13.8:i===1?9:11}" step="0.1">%</label><label>Riesgo (1-10) <input data-cmp="risk${i}" type="number" min="1" max="10" value="${i+3}"></label><label>Liquidez (1-10) <input data-cmp="liq${i}" type="number" min="1" max="10" value="${10-i*2}"></label><label>Horizonte (años) <input data-cmp="hor${i}" type="number" min="1" value="5"></label><div class="compare-result"><span class="state-chip chip-neutral" data-cmpout="${i}">REGULAR</span><b data-cmpscore="${i}">Puntaje 0/100</b></div></div>`).join('');g.dataset.ready='1';g.querySelectorAll('input').forEach(i=>i.addEventListener('input',scoreCompare));scoreCompare()}
function scoreCompare(){document.querySelectorAll('.compare-card').forEach((c,i)=>{const ret=parseFloat(c.querySelector(`[data-cmp="ret${i}"]`).value)||0,risk=parseFloat(c.querySelector(`[data-cmp="risk${i}"]`).value)||5,liq=parseFloat(c.querySelector(`[data-cmp="liq${i}"]`).value)||5;const s=clamp(ret*4+(10-risk)*4+liq*2,0,100),kind=s>=70?'good':s>=50?'neutral':'bad',d=kindData(kind),chip=c.querySelector(`[data-cmpout="${i}"]`);chip.className=`state-chip chip-${kind}`;chip.textContent=d.label;c.querySelector(`[data-cmpscore="${i}"]`).textContent=`Puntaje ${Math.round(s)}/100`})}
function calcWhatIf(){const price=n('wfPrice'),growth=n('wfGrowth')/100,disc=n('wfDiscount')/100,years=Math.max(1,n('wfYears'));const v=price*Math.pow(1+growth,years), margin=disc>0?((v-price)/v):0, ratio=price>0?v/price:0,kind=ratio>1.7&&margin>.1?'good':ratio>1.35?'neutral':'bad';$('wfValue').textContent=money(v);$('wfReturn').textContent=pct(growth);$('wfMargin').textContent=pct(margin);const b=$('wfBadge');b.className='scenario-badge '+kind;b.textContent=kindData(kind).label}
const glossary=[
['PER','Relación entre precio de mercado y ganancias por acción.'],['EPS','Utilidad o beneficio atribuible a cada acción.'],['ROE','Rentabilidad generada sobre el patrimonio de los accionistas.'],['ROIC','Retorno generado sobre el capital invertido.'],['P/B','Precio de mercado comparado con valor en libros.'],['P/S','Precio de la acción dividido por ventas por acción.'],['EV/EBITDA','Valor de empresa comparado con EBITDA.'],['Dividend Yield','Dividendo anual como porcentaje del precio.'],['Payout','Proporción de las ganancias distribuida como dividendos.'],['CAGR','Tasa de crecimiento anual compuesto.'],['Margen de seguridad','Diferencia entre valor estimado y precio de mercado.'],['Tasa de descuento','Rentabilidad mínima exigida para valorar flujos futuros.'],['WACC','Costo promedio ponderado del capital.'],['FCF','Flujo de caja libre disponible después de inversiones necesarias.'],['DCF','Método de valoración por descuento de flujos de caja.'],['Valor intrínseco','Estimación del valor económico de un activo.'],['Capitalización bursátil','Valor de mercado total de las acciones de una empresa.'],['Enterprise Value','Valor de empresa considerando deuda y caja.'],['EBITDA','Resultado antes de intereses, impuestos, depreciación y amortización.'],['Margen bruto','Ventas menos costo de ventas, como porcentaje de ventas.'],['Margen operativo','Utilidad operativa como porcentaje de ventas.'],['Margen neto','Utilidad neta como porcentaje de ventas.'],['Crecimiento de ingresos','Incremento de ventas de una empresa o proyecto.'],['Flujo de caja','Entradas y salidas de efectivo.'],['Liquidez','Facilidad con la que una inversión puede convertirse en efectivo.'],['Volatilidad','Magnitud de las variaciones del precio a lo largo del tiempo.'],['Beta','Sensibilidad de un activo frente a movimientos del mercado.'],['Alfa','Rendimiento adicional frente a un referente, ajustado por riesgo.'],['Sharpe','Medida del rendimiento excedente por unidad de volatilidad.'],['Drawdown','Caída desde un máximo hasta un mínimo posterior.'],['Diversificación','Distribución del capital entre activos o riesgos diferentes.'],['Riesgo de mercado','Posibilidad de pérdida por cambios generales del mercado.'],['Riesgo de crédito','Posibilidad de incumplimiento del emisor o contraparte.'],['Duración','Sensibilidad aproximada de un bono a cambios de tasas.'],['Cupón','Interés periódico pagado por un bono.'],['Rendimiento a vencimiento','Tasa implícita si un bono se mantiene hasta vencimiento.'],['CDT','Certificado de depósito a término.'],['ETF','Fondo cotizado que agrupa activos y se negocia en bolsa.'],['TER','Gasto anual de operación de un ETF o fondo.'],['AUM','Activos bajo administración de un fondo.'],['REIT','Vehículo que invierte principalmente en activos inmobiliarios generadores de renta.'],['Cap Rate','Renta operativa neta anual dividida por valor del inmueble.'],['Vacancia','Tiempo o porcentaje en que un inmueble no genera renta.'],['ROI','Retorno de una inversión en relación con el capital invertido.'],['IRR / TIR','Tasa que iguala a cero el valor presente neto de un proyecto.'],['NPV / VPN','Valor presente neto de los flujos de una inversión.'],['Payback','Tiempo estimado para recuperar la inversión inicial.'],['Punto de equilibrio','Nivel de ventas donde ingresos y costos se igualan.'],['Inflación','Aumento general de precios que reduce poder adquisitivo.'],['Rendimiento real','Rendimiento descontando el efecto de la inflación.'],['Costo de oportunidad','Beneficio que se deja de obtener al escoger una alternativa.'],['Apalancamiento','Uso de deuda para financiar una inversión o negocio.'],['Ratio deuda/EBITDA','Indicador del peso de la deuda frente a la generación operativa.'],['DSCR','Capacidad de cubrir obligaciones de deuda con flujo disponible.'],['Acción','Participación de propiedad en una empresa.'],['Bono','Instrumento de deuda emitido por un gobierno o empresa.'],['Mercado alcista','Período caracterizado por una tendencia general de subida.'],['Mercado bajista','Período caracterizado por una tendencia general de caída.'],['Spread','Diferencia entre dos precios, tasas o rendimientos.'],['Stop loss','Regla operativa para limitar una pérdida; su uso depende de la estrategia.'],['Take profit','Regla operativa para fijar una toma de ganancias; depende de la estrategia.']
];
function buildGlossary(filter=''){const g=$('glossaryGrid');const f=filter.toLowerCase();g.innerHTML=glossary.filter(x=>x[0].toLowerCase().includes(f)||x[1].toLowerCase().includes(f)).map(x=>`<div class="glossary-item"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')||'<div class="card" style="padding:20px">No encontramos ese término.</div>';g.dataset.ready='1'}
function setupDark(){const saved=localStorage.getItem('mm_dark')==='1';$('darkMode').checked=saved;document.body.classList.toggle('dark',saved);}
function closeMobileMenu(){document.body.classList.remove('menu-open');}
function setupMobileMenu(){const btn=$('mobileMenuBtn');if(!btn)return;btn.addEventListener('click',()=>document.body.classList.toggle('menu-open'));document.querySelectorAll('.side-item').forEach(b=>b.addEventListener('click',closeMobileMenu));}
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

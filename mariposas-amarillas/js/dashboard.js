// ============================================================
// DASHBOARD ESTADÍSTICO — Mariposas Amarillas
// ============================================================
// ===== GOOGLE SHEETS CONFIG =====
const SHEET_ID  = '1oVAsoodAXiP9z4cZPn2_vYXBMrvIIz18XdhqVs9grKY';
const SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// ===== AUTH =====
const PASSWORD_ADMIN = 'admin123';
const CLAVE_SESION   = 'admin_mariposas';

function verificarLogin() {
  const input = document.getElementById('campo-password').value;
  const error = document.getElementById('error-msg');
  if (input === PASSWORD_ADMIN) {
    sessionStorage.setItem(CLAVE_SESION, 'true');
    mostrarDashboard();
  } else {
    error.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
    document.getElementById('campo-password').value = '';
    document.getElementById('campo-password').focus();
  }
}

function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
  document.getElementById('dashboard-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('campo-password').value = '';
  document.getElementById('error-msg').textContent = '';
}

function mostrarDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  init();
}

// ===== DATOS GLOBALES (se cargan una sola vez en init) =====
let DATOS_GLOBALES = [];

// ===== COLORES =====
const COLORES = ['#EF9F27','#854F0B','#BA7517','#FAC775','#633806','#1D9E75','#412402','#5DCAA5','#9FE1CB'];

// ===== ORDEN NATURAL DE EDADES =====
const ORDEN_EDAD = ['Menor de 18','18 a 25','26 a 35','36 a 45','46 a 60','Mayor de 60'];

// ===== CARGAR DATOS DESDE GOOGLE SHEETS =====
async function cargarDatosFirebase() {
  try {
    const res  = await fetch(SHEET_CSV);
    const text = await res.text();

    // Parser CSV robusto: maneja campos entre comillas que contienen comas
    function parsearCSV(texto) {
      return texto.trim().split('\n').map(linea => {
        const campos = [];
        let actual = '';
        let dentroComillas = false;
        for (let i = 0; i < linea.length; i++) {
          const c = linea[i];
          if (c === '"') {
            dentroComillas = !dentroComillas;
          } else if (c === ',' && !dentroComillas) {
            campos.push(actual.trim());
            actual = '';
          } else {
            actual += c;
          }
        }
        campos.push(actual.trim());
        return campos;
      });
    }

    const filas = parsearCSV(text);
    if (filas.length < 2) return [];
    // Columnas esperadas del Google Form:
    // 0:Marca de tiempo, 1:Edad, 2:Procedencia, 3:Tipo
    return filas.slice(1).map((f, i) => {
      const ts = f[0] || '';
      const partes = ts.split(' ');
      return {
        id:          i + 1,
        fecha:       partes[0] || '',
        hora:        partes[1] || '',
        monumento:   'Mariposas Amarillas de Mauricio Babilonia',
        edad:        f[1] || '',
        procedencia: f[2] || '',
        tipo:        f[3] || ''
      };
    }).filter(r => r.edad && r.procedencia && r.tipo);
  } catch (e) {
    console.error('Error leyendo Google Sheets:', e);
    return [];
  }
}

// ===== FRECUENCIAS =====
function calcularFrecuencias(datos, campo, orden) {
  const conteo = {};
  datos.forEach(r => {
    const val = r[campo] || 'Sin dato';
    conteo[val] = (conteo[val] || 0) + 1;
  });
  const total = datos.length;
  let entradas = Object.entries(conteo).map(([etiqueta, frec]) => ({
    etiqueta,
    frecAbs: frec,
    frecRel: total > 0 ? frec / total : 0,
    porcentaje: total > 0 ? ((frec / total) * 100).toFixed(1) : '0.0'
  }));
  if (orden) {
    entradas.sort((a, b) => orden.indexOf(a.etiqueta) - orden.indexOf(b.etiqueta));
  } else {
    entradas.sort((a, b) => b.frecAbs - a.frecAbs);
  }
  return entradas;
}

// ===== MEDIDAS ESTADÍSTICAS =====
// Para edad usamos el punto medio de cada rango
const PUNTO_MEDIO = {
  // Sin "años" (formato interno del formulario)
  'Menor de 18': 14, '18 a 25': 21.5, '26 a 35': 30.5,
  '36 a 45': 40.5, '46 a 60': 53, 'Mayor de 60': 65,
  // Con "años" (formato que puede venir de Google Forms)
  'Menor de 18 años': 14, '18 a 25 años': 21.5, '26 a 35 años': 30.5,
  '36 a 45 años': 40.5, '46 a 60 años': 53, 'Mayor de 60 años': 65
};

function calcularModa(frecuencias) {
  if (!frecuencias.length) return '—';
  return frecuencias.slice().sort((a,b) => b.frecAbs - a.frecAbs)[0].etiqueta;
}

function calcularMediaEdad(datos) {
  if (!datos.length) return '—';
  const vals = datos.map(r => PUNTO_MEDIO[r.edad] || 0).filter(v => v > 0);
  if (!vals.length) return '—';
  return (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1);
}

function calcularMedianaEdad(datos) {
  if (!datos.length) return '—';
  const vals = datos.map(r => PUNTO_MEDIO[r.edad] || 0).filter(v => v > 0).sort((a,b) => a-b);
  if (!vals.length) return '—';
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 !== 0
    ? vals[mid].toFixed(1)
    : ((vals[mid-1] + vals[mid]) / 2).toFixed(1);
}

// ===== ① KPIs =====
function renderKPIs(datos) {
  const el = document.getElementById('kpi-grid');
  if (!datos.length) {
    el.innerHTML = '<p class="empty-state">Aún no hay registros. Escanea el QR para comenzar.</p>';
    return;
  }
  const freqEdad = calcularFrecuencias(datos, 'edad');
  const freqProc = calcularFrecuencias(datos, 'procedencia');
  const freqTipo = calcularFrecuencias(datos, 'tipo');
  const kpis = [
    { num: datos.length,                label: 'Total de visitas' },
    { num: 1,                           label: 'Monumentos registrados' },
    { num: calcularModa(freqEdad),      label: 'Grupo etario predominante' },
    { num: calcularModa(freqProc),      label: 'Procedencia predominante' },
    { num: calcularModa(freqTipo),      label: 'Tipo de visitante predominante' },
  ];
  el.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-num">${k.num}</div>
      <div class="kpi-label">${k.label}</div>
    </div>`).join('');
}

// ===== ② MEDIDAS ESTADÍSTICAS =====
function renderMedidas(datos) {
  const el = document.getElementById('medidas-edad');
  if (!datos.length) { el.innerHTML = ''; return; }
  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const media    = calcularMediaEdad(datos);
  const mediana  = calcularMedianaEdad(datos);
  const moda     = calcularModa(freqEdad);
  const cards = [
    { num: media,   lbl: 'Media (punto medio)' },
    { num: mediana, lbl: 'Mediana (punto medio)' },
    { num: moda,    lbl: 'Moda (rango más frecuente)' },
    { num: datos.length, lbl: 'N total' },
  ];
  el.innerHTML = cards.map(c => `
    <div class="medida-card">
      <div class="medida-num">${c.num}</div>
      <div class="medida-lbl">${c.lbl}</div>
    </div>`).join('');
}

// ===== ③ TABLAS DE FRECUENCIA =====
function renderTabla(id, frecuencias) {
  const el = document.getElementById(id);
  if (!frecuencias.length) { el.innerHTML = '<p class="empty-state">Sin datos aún.</p>'; return; }
  const filas = frecuencias.map(f => `
    <tr>
      <td>${f.etiqueta}</td>
      <td style="text-align:center;">${f.frecAbs}</td>
      <td style="text-align:center;">${f.frecRel.toFixed(4)}</td>
      <td style="text-align:center;">${f.porcentaje}%</td>
    </tr>`).join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>Categoría</th><th>Frec. absoluta</th><th>Frec. relativa</th><th>Porcentaje</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// ===== GRÁFICOS =====
const graficos = {};

function crearGrafico(id, tipo, labels, datasets, opciones = {}) {
  if (graficos[id]) graficos[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  graficos[id] = new Chart(ctx.getContext('2d'), {
    type: tipo,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { display: tipo === 'pie' || tipo === 'doughnut' || !!opciones.leyenda },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw} visitantes` } }
      },
      scales: (tipo === 'bar' || tipo === 'histogram') ? {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      } : {},
      ...opciones.extra
    }
  });
}

// ===== TABLA DE REGISTROS =====
function renderRegistros(datos) {
  const el = document.getElementById('tabla-registros');
  if (!datos.length) { el.innerHTML = '<p class="empty-state">Sin registros aún.</p>'; return; }
  const filas = datos.map((r, i) => `
    <tr>
      <td>${i+1}</td><td>${r.fecha}</td><td>${r.hora}</td>
      <td>${r.edad}</td><td>${r.procedencia}</td><td>${r.tipo}</td>
    </tr>`).join('');
  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="min-width:500px;">
        <thead><tr><th>#</th><th>Fecha</th><th>Hora</th><th>Edad</th><th>Procedencia</th><th>Tipo</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// ===== ④ CRUCE DE VARIABLES =====
function renderCruce() {
  const datos = DATOS_GLOBALES;
  const sel   = document.getElementById('cruce-selector').value;

  // Casos especiales: Monumento como fila fija
  if (sel === 'monumento_procedencia' || sel === 'monumento_edad') {
    const campoCol2 = sel === 'monumento_procedencia' ? 'procedencia' : 'edad';
    const ordenCol  = campoCol2 === 'edad' ? ORDEN_EDAD : null;
    const freqCol   = calcularFrecuencias(datos, campoCol2, ordenCol);
    const valsCol2  = freqCol.map(f => f.etiqueta);
    const nomMon    = 'Mariposas Amarillas';

    if (!valsCol2.length) {
      document.getElementById('tabla-cruce').innerHTML = '<p class="empty-state">Sin datos aún.</p>';
      if (graficos['chart-cruce']) { graficos['chart-cruce'].destroy(); delete graficos['chart-cruce']; }
      return;
    }

    const enc2   = valsCol2.map(c => `<th>${c}</th>`).join('');
    const celdas2 = valsCol2.map(c => {
      const f = freqCol.find(x => x.etiqueta === c);
      return `<td style="text-align:center;">${f ? f.frecAbs : 0}</td>`;
    }).join('');

    document.getElementById('tabla-cruce').innerHTML = `
      <div style="overflow-x:auto; margin-bottom:1rem;">
        <table style="min-width:400px;">
          <thead><tr><th>Monumento / ${campoCol2}</th>${enc2}</tr></thead>
          <tbody><tr><td><strong>${nomMon}</strong></td>${celdas2}</tr></tbody>
        </table>
      </div>`;

    crearGrafico('chart-cruce', 'bar', valsCol2,
      [{ label: nomMon,
         data: valsCol2.map(c => { const f = freqCol.find(x => x.etiqueta === c); return f ? f.frecAbs : 0; }),
         backgroundColor: COLORES.slice(0, valsCol2.length),
         borderRadius: 6, borderWidth: 0 }],
      { leyenda: false });
    return;
  }

  let campoFila, campoCol;
  if (sel === 'edad_procedencia')  { campoFila = 'edad';        campoCol = 'procedencia'; }
  if (sel === 'edad_tipo')         { campoFila = 'edad';        campoCol = 'tipo'; }
  if (sel === 'procedencia_tipo')  { campoFila = 'procedencia'; campoCol = 'tipo'; }

  const valsFila = [...new Set(datos.map(r => r[campoFila]))].sort();
  const valsCol  = [...new Set(datos.map(r => r[campoCol]))].sort();

  if (!valsFila.length || !valsCol.length) {
    document.getElementById('tabla-cruce').innerHTML = '<p class="empty-state">Sin datos aún.</p>';
    return;
  }

  // Construir matriz de cruce
  const matriz = {};
  valsFila.forEach(f => { matriz[f] = {}; valsCol.forEach(c => { matriz[f][c] = 0; }); });
  datos.forEach(r => {
    if (matriz[r[campoFila]] !== undefined) matriz[r[campoFila]][r[campoCol]] = (matriz[r[campoFila]][r[campoCol]] || 0) + 1;
  });

  // Tabla de cruce
  const encabezados = valsCol.map(c => `<th>${c}</th>`).join('');
  const filas = valsFila.map(f => {
    const celdas = valsCol.map(c => `<td style="text-align:center;">${matriz[f][c] || 0}</td>`).join('');
    return `<tr><td><strong>${f}</strong></td>${celdas}</tr>`;
  }).join('');

  document.getElementById('tabla-cruce').innerHTML = `
    <div style="overflow-x:auto; margin-bottom:1rem;">
      <table style="min-width:400px;">
        <thead><tr><th>${campoFila} / ${campoCol}</th>${encabezados}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;

  // Gráfico comparativo de cruce
  const datasets = valsCol.map((col, i) => ({
    label: col,
    data: valsFila.map(f => matriz[f][col] || 0),
    backgroundColor: COLORES[i % COLORES.length],
    borderRadius: 5,
    borderWidth: 0
  }));

  crearGrafico('chart-cruce', 'bar', valsFila, datasets, { leyenda: true });
}

// ===== TABS =====
function mostrarTab(nombre, event) {
  ['edad','procedencia','tipo','registros'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
  });
  document.getElementById(`tab-${nombre}`).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
}

// ===== EXPORTAR A EXCEL DETALLADO CON GRÁFICOS =====
async function exportarExcel() {
  const datos = DATOS_GLOBALES;
  if (!datos.length) { alert('No hay datos para exportar aún.'); return; }

  // Asegurar que todos los tabs estén renderizados para capturar canvas
  ['edad','procedencia','tipo','registros'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.remove('hidden');
  });
  // Esperar un frame para que Chart.js renderice
  await new Promise(r => setTimeout(r, 150));

  const wb   = XLSX.utils.book_new();
  const total = datos.length;

  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const freqProc = calcularFrecuencias(datos, 'procedencia');
  const freqTipo = calcularFrecuencias(datos, 'tipo');

  // ── Estilos reutilizables ────────────────────────────────────
  const BORDER = { top:{style:'thin',color:{rgb:'CCCCCC'}}, bottom:{style:'thin',color:{rgb:'CCCCCC'}}, left:{style:'thin',color:{rgb:'CCCCCC'}}, right:{style:'thin',color:{rgb:'CCCCCC'}} };
  function cell(v, fill, fontColor, bold = false, align = 'center') {
    return {
      v, t: typeof v === 'number' ? 'n' : 's',
      s: {
        fill:      { patternType:'solid', fgColor:{ rgb: fill } },
        font:      { color:{ rgb: fontColor }, bold, sz: 10 },
        border:    BORDER,
        alignment: { horizontal: align, vertical:'center', wrapText: true }
      }
    };
  }
  const H1  = (v) => cell(v, '854F0B', 'FFFFFF', true,  'center');
  const H2  = (v) => cell(v, 'EF9F27', 'FFFFFF', true,  'center');
  const H3  = (v) => cell(v, 'FAEEDA', '412402', true,  'center');
  const D   = (v, al='center') => cell(v, 'FFFFFF', '444444', false, al);
  const DA  = (v, al='center') => cell(v, 'FFF8EC', '444444', false, al);
  const TOT = (v) => cell(v, 'FAEEDA', '412402', true,  'center');

  function setCells(ws, arr) {
    // arr = [[ref, cellObj], ...]
    arr.forEach(([ref, c]) => { ws[ref] = c; });
    const refs = arr.map(([r]) => r);
    const cols = refs.map(r => r.charCodeAt(0) - 65);
    const rows = refs.map(r => parseInt(r.slice(1)) - 1);
    const maxC = Math.max(...cols);
    const maxR = Math.max(...rows);
    if (!ws['!ref']) ws['!ref'] = `A1:${String.fromCharCode(65+maxC)}${maxR+1}`;
    else {
      const cur = XLSX.utils.decode_range(ws['!ref']);
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r:0, c:0 },
        e: { r: Math.max(cur.e.r, maxR), c: Math.max(cur.e.c, maxC) }
      });
    }
  }

  // ── Capturar imagen de un canvas ────────────────────────────
  function canvasImagen(id) {
    const c = document.getElementById(id);
    if (!c) return null;
    try { return c.toDataURL('image/png').split(',')[1]; } catch(e) { return null; }
  }

  // ── Insertar imagen en hoja xlsx ────────────────────────────
  function insertarImagen(wb, wsName, b64, col, row, ancho, alto) {
    if (!b64) return;
    if (!wb.Sheets[wsName]['!images']) wb.Sheets[wsName]['!images'] = [];
    wb.Sheets[wsName]['!images'].push({
      '!pos': { r: row, c: col, x: 0, y: 0, w: ancho, h: alto },
      '!datatype': 'base64',
      '!data': b64,
      '!type': 'png'
    });
  }

  // ════════════════════════════════════════════════════════════
  // HOJA 1 — RESUMEN GENERAL
  // ════════════════════════════════════════════════════════════
  const ws1 = {};
  setCells(ws1, [
    ['A1', H1('SISTEMA INTELIGENTE DE INFORMACIÓN TURÍSTICA — MARIPOSAS AMARILLAS')],
    ['A2', H2('Monumento: Mariposas Amarillas · Riohacha, La Guajira')],
    ['A3', D('Exportado el: ' + new Date().toLocaleString('es-CO'))],
    ['A5', H2('INDICADORES GENERALES')],
    ['A6', H3('Indicador')], ['B6', H3('Valor')],
    ['A7',  D('Total de visitas',       'left')], ['B7',  D(total)],
    ['A8',  D('Monumento',              'left')], ['B8',  D('Mariposas Amarillas')],
    ['A9',  D('Grupo etario predominante','left')],['B9',  D(calcularModa(freqEdad))],
    ['A10', D('Procedencia predominante','left')], ['B10', D(calcularModa(freqProc))],
    ['A11', D('Tipo de visitante predominante','left')], ['B11', D(calcularModa(freqTipo))],
    ['A13', H2('MEDIDAS ESTADÍSTICAS — EDAD')],
    ['A14', H3('Medida')], ['B14', H3('Valor')], ['C14', H3('Descripción')],
    ['A15', D('Media',    'left')], ['B15', D(parseFloat(calcularMediaEdad(datos)))],    ['C15', D('Promedio ponderado por punto medio de rango','left')],
    ['A16', D('Mediana',  'left')], ['B16', D(parseFloat(calcularMedianaEdad(datos)))],  ['C16', D('Valor central de la distribución','left')],
    ['A17', D('Moda',     'left')], ['B17', D(calcularModa(freqEdad))],                  ['C17', D('Rango de edad con mayor frecuencia','left')],
    ['A18', D('N total',  'left')], ['B18', D(total)],                                   ['C18', D('Número total de registros','left')],
  ]);
  ws1['!merges'] = [
    {s:{r:0,c:0},e:{r:0,c:2}}, {s:{r:1,c:0},e:{r:1,c:2}},
    {s:{r:2,c:0},e:{r:2,c:2}}, {s:{r:4,c:0},e:{r:4,c:2}},
    {s:{r:12,c:0},e:{r:12,c:2}}
  ];
  ws1['!cols'] = [{wch:40},{wch:24},{wch:42}];
  ws1['!rows'] = Array(18).fill({hpt:20});
  ws1['!rows'][0] = {hpt:28};
  XLSX.utils.book_append_sheet(wb, ws1, '📊 Resumen');

  // ════════════════════════════════════════════════════════════
  // HOJA 2 — REGISTROS
  // ════════════════════════════════════════════════════════════
  const ws2 = {};
  const refsReg = [
    ['A1', H1('REGISTROS DE VISITAS — Monumento Mariposas Amarillas')],
    ['A2', H2('#')], ['B2', H2('Fecha')], ['C2', H2('Hora')],
    ['D2', H2('Edad')], ['E2', H2('Procedencia')], ['F2', H2('Tipo de visitante')],
  ];
  datos.forEach((r, i) => {
    const row = i + 3;
    const fn  = i % 2 === 0 ? D : DA;
    refsReg.push(
      [`A${row}`, fn(i+1)],
      [`B${row}`, fn(r.fecha,       'left')],
      [`C${row}`, fn(r.hora)],
      [`D${row}`, fn(r.edad,        'left')],
      [`E${row}`, fn(r.procedencia, 'left')],
      [`F${row}`, fn(r.tipo,        'left')]
    );
  });
  setCells(ws2, refsReg);
  ws2['!merges'] = [{s:{r:0,c:0},e:{r:0,c:5}}];
  ws2['!cols'] = [{wch:5},{wch:13},{wch:9},{wch:18},{wch:32},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws2, '📋 Registros');

  // ════════════════════════════════════════════════════════════
  // FUNCIÓN HOJA DE FRECUENCIA + IMAGEN DE GRÁFICO
  // ════════════════════════════════════════════════════════════
  function hojaFreq(freq, nombre, titulo, canvasIds) {
    const ws = {};
    const refs = [
      ['A1', H1(titulo)],
      ['A3', H2('TABLA DE FRECUENCIAS')],
      ['A4', H3('Categoría')], ['B4', H3('Frec. Absoluta')],
      ['C4', H3('Frec. Relativa')], ['D4', H3('Porcentaje (%)')], ['E4', H3('Acumulada (%)')],
    ];
    let acum = 0;
    freq.forEach((f, i) => {
      const row = i + 5;
      acum += parseFloat(f.porcentaje);
      const fn = i % 2 === 0 ? D : DA;
      refs.push(
        [`A${row}`, fn(f.etiqueta, 'left')],
        [`B${row}`, fn(f.frecAbs)],
        [`C${row}`, fn(parseFloat(f.frecRel.toFixed(4)))],
        [`D${row}`, fn(parseFloat(f.porcentaje))],
        [`E${row}`, fn(parseFloat(acum.toFixed(1)))]
      );
    });
    const totalRow = freq.length + 5;
    refs.push(
      [`A${totalRow}`, TOT('TOTAL')], [`B${totalRow}`, TOT(total)],
      [`C${totalRow}`, TOT(1.0)],     [`D${totalRow}`, TOT(100.0)], [`E${totalRow}`, TOT('')]
    );
    // Interpretación
    const iRow = totalRow + 2;
    refs.push(
      [`A${iRow}`,   H2('INTERPRETACIÓN')],
      [`A${iRow+1}`, D('Moda', 'left')],   [`B${iRow+1}`, D(calcularModa(freq), 'left')],
      [`A${iRow+2}`, D('Mayor frecuencia','left')], [`B${iRow+2}`, D(freq.slice().sort((a,b)=>b.frecAbs-a.frecAbs)[0]?.etiqueta||'—','left')],
      [`A${iRow+3}`, D('Menor frecuencia','left')], [`B${iRow+3}`, D(freq.slice().sort((a,b)=>a.frecAbs-b.frecAbs)[0]?.etiqueta||'—','left')]
    );
    setCells(ws, refs);
    ws['!merges'] = [
      {s:{r:0,c:0},e:{r:0,c:4}},
      {s:{r:2,c:0},e:{r:2,c:4}},
      {s:{r:iRow-1,c:0},e:{r:iRow-1,c:4}}
    ];
    ws['!cols'] = [{wch:32},{wch:17},{wch:17},{wch:17},{wch:17}];
    XLSX.utils.book_append_sheet(wb, ws, nombre);

    // Insertar imágenes de gráficos
    const imgRow = iRow + 5;
    canvasIds.forEach((cid, idx) => {
      const img = canvasImagen(cid);
      if (img) insertarImagen(wb, nombre, img, idx * 4, imgRow, 480, 300);
    });
  }

  hojaFreq(freqEdad, '👤 Edad',        'DISTRIBUCIÓN POR EDAD',           ['chart-edad-bar','chart-edad-hist']);
  hojaFreq(freqProc, '📍 Procedencia', 'DISTRIBUCIÓN POR PROCEDENCIA',    ['chart-proc-bar','chart-proc-pie']);
  hojaFreq(freqTipo, '🪪 Tipo Visitante','DISTRIBUCIÓN POR TIPO VISITANTE',['chart-tipo-bar','chart-tipo-pie']);

  // ════════════════════════════════════════════════════════════
  // FUNCIÓN HOJA DE CRUCE + IMAGEN
  // ════════════════════════════════════════════════════════════
  function hojaCruce(campoFila, campoCol, ordenFila, nombre, titulo, canvasId) {
    const valsFila = ordenFila
      ? ordenFila.filter(v => datos.some(r => r[campoFila] === v))
      : [...new Set(datos.map(r => r[campoFila]))].sort();
    const valsCol  = [...new Set(datos.map(r => r[campoCol]))].sort();
    const matriz   = {};
    valsFila.forEach(f => { matriz[f] = {}; valsCol.forEach(c => { matriz[f][c] = 0; }); });
    datos.forEach(r => {
      if (matriz[r[campoFila]] !== undefined)
        matriz[r[campoFila]][r[campoCol]] = (matriz[r[campoFila]][r[campoCol]] || 0) + 1;
    });

    const colLetras = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, valsCol.length);
    const totCol    = String.fromCharCode(66 + valsCol.length);
    const ws = {};
    const refs = [['A1', H1(titulo)]];
    refs.push(['A3', H2('TABLA DE CONTINGENCIA')]);
    refs.push(['A4', H3(campoFila + ' \ ' + campoCol)]);
    valsCol.forEach((c, i) => refs.push([`${colLetras[i]}4`, H3(c)]));
    refs.push([`${totCol}4`, H3('TOTAL')]);

    valsFila.forEach((f, i) => {
      const row = i + 5;
      const fn  = i % 2 === 0 ? D : DA;
      refs.push([`A${row}`, fn(f, 'left')]);
      let tot = 0;
      valsCol.forEach((c, ci) => {
        const v = matriz[f][c] || 0; tot += v;
        refs.push([`${colLetras[ci]}${row}`, fn(v)]);
      });
      refs.push([`${totCol}${row}`, TOT(tot)]);
    });
    const totalRow = valsFila.length + 5;
    refs.push([`A${totalRow}`, TOT('TOTAL')]);
    valsCol.forEach((c, ci) => {
      const v = valsFila.reduce((s,f) => s + (matriz[f][c]||0), 0);
      refs.push([`${colLetras[ci]}${totalRow}`, TOT(v)]);
    });
    refs.push([`${totCol}${totalRow}`, TOT(total)]);

    setCells(ws, refs);
    const mergeEnd = valsCol.length + 1;
    ws['!merges'] = [
      {s:{r:0,c:0},e:{r:0,c:mergeEnd}},
      {s:{r:2,c:0},e:{r:2,c:mergeEnd}}
    ];
    ws['!cols'] = [{wch:28}, ...valsCol.map(()=>({wch:18})), {wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, nombre);

    // Capturar gráfico del cruce: primero seleccionar ese cruce en el selector
    if (canvasId) {
      const img = canvasImagen(canvasId);
      if (img) insertarImagen(wb, nombre, img, 0, totalRow + 2, 600, 320);
    }
  }

  // Generar gráficos de cruce uno por uno y capturarlos
  async function capturaGraficoCruce(valor) {
    document.getElementById('cruce-selector').value = valor;
    renderCruce();
    await new Promise(r => setTimeout(r, 200));
    return canvasImagen('chart-cruce');
  }

  const imgEdadProc  = await capturaGraficoCruce('edad_procedencia');
  const imgEdadTipo  = await capturaGraficoCruce('edad_tipo');
  const imgProcTipo  = await capturaGraficoCruce('procedencia_tipo');
  const imgMonProc   = await capturaGraficoCruce('monumento_procedencia');
  const imgMonEdad   = await capturaGraficoCruce('monumento_edad');

  hojaCruce('edad', 'procedencia', ORDEN_EDAD, '🔀 Edad vs Procedencia',   'CRUCE: EDAD vs PROCEDENCIA',          null);
  hojaCruce('edad', 'tipo',        ORDEN_EDAD, '🔀 Edad vs Tipo',          'CRUCE: EDAD vs TIPO DE VISITANTE',    null);
  hojaCruce('procedencia','tipo',  null,       '🔀 Procedencia vs Tipo',   'CRUCE: PROCEDENCIA vs TIPO VISITANTE',null);

  // Insertar imágenes de cruces manualmente
  const cruceSheets = ['🔀 Edad vs Procedencia','🔀 Edad vs Tipo','🔀 Procedencia vs Tipo'];
  const cruceImgs   = [imgEdadProc, imgEdadTipo, imgProcTipo];
  cruceSheets.forEach((sh, i) => {
    if (cruceImgs[i] && wb.Sheets[sh]) {
      if (!wb.Sheets[sh]['!images']) wb.Sheets[sh]['!images'] = [];
      wb.Sheets[sh]['!images'].push({
        '!pos': { r: 20, c: 0, x:0, y:0, w:600, h:320 },
        '!datatype': 'base64', '!data': cruceImgs[i], '!type': 'png'
      });
    }
  });

  // Cruces monumento (hojas simples)
  function hojaMonumento(campoCol, ordenCol, nombre, titulo, imgB64) {
    const freq    = calcularFrecuencias(datos, campoCol, ordenCol);
    const valsCol = freq.map(f => f.etiqueta);
    const colLetras = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, valsCol.length);
    const totCol    = String.fromCharCode(66 + valsCol.length);
    const ws = {};
    const refs = [['A1', H1(titulo)], ['A3', H2('TABLA DE CONTINGENCIA')],
      ['A4', H3('Monumento \ ' + campoCol)]];
    valsCol.forEach((c,i) => refs.push([`${colLetras[i]}4`, H3(c)]));
    refs.push([`${totCol}4`, H3('TOTAL')]);
    refs.push(['A5', D('Mariposas Amarillas','left')]);
    valsCol.forEach((c,i) => {
      const f = freq.find(x=>x.etiqueta===c);
      refs.push([`${colLetras[i]}5`, D(f?f.frecAbs:0)]);
    });
    refs.push([`${totCol}5`, TOT(total)]);
    refs.push(['A6', TOT('TOTAL')]);
    valsCol.forEach((c,i) => {
      const f = freq.find(x=>x.etiqueta===c);
      refs.push([`${colLetras[i]}6`, TOT(f?f.frecAbs:0)]);
    });
    refs.push([`${totCol}6`, TOT(total)]);
    setCells(ws, refs);
    const mergeEnd = valsCol.length + 1;
    ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:mergeEnd}},{s:{r:2,c:0},e:{r:2,c:mergeEnd}}];
    ws['!cols']   = [{wch:28},...valsCol.map(()=>({wch:18})),{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, nombre);
    if (imgB64 && wb.Sheets[nombre]) {
      if (!wb.Sheets[nombre]['!images']) wb.Sheets[nombre]['!images'] = [];
      wb.Sheets[nombre]['!images'].push({ '!pos':{r:8,c:0,x:0,y:0,w:600,h:320}, '!datatype':'base64','!data':imgB64,'!type':'png' });
    }
  }

  hojaMonumento('procedencia', null,       '🔀 Monumento vs Procedencia', 'CRUCE: MONUMENTO vs PROCEDENCIA', imgMonProc);
  hojaMonumento('edad',        ORDEN_EDAD, '🔀 Monumento vs Edad',        'CRUCE: MONUMENTO vs EDAD',        imgMonEdad);

  // Restaurar tabs
  ['procedencia','tipo','registros'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
  });

  const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
  XLSX.writeFile(wb, `estadisticas_mariposas_${fecha}.xlsx`);
}

// ===== LIMPIAR DATOS =====
function limpiarDatos() {
  if (confirm('Para eliminar registros debes hacerlo directamente en el Google Sheet. ¿Quieres abrirlo ahora?')) {
    window.open('https://docs.google.com/spreadsheets/d/' + SHEET_ID, '_blank');
  }
}

// ===== INIT =====
async function init() {
  if (!sessionStorage.getItem(CLAVE_SESION)) return;
  document.getElementById('kpi-grid').innerHTML = '<p class="empty-state">⏳ Cargando datos desde Google Sheets…</p>';
  const datos = await cargarDatosFirebase();
  DATOS_GLOBALES = datos;

  renderKPIs(datos);
  renderMedidas(datos);

  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const freqProc = calcularFrecuencias(datos, 'procedencia');
  const freqTipo = calcularFrecuencias(datos, 'tipo');

  renderTabla('tabla-edad',        freqEdad);
  renderTabla('tabla-procedencia', freqProc);
  renderTabla('tabla-tipo',        freqTipo);
  renderRegistros(datos);

  // Gráficos edad: barras + histograma
  crearGrafico('chart-edad-bar', 'bar', freqEdad.map(f=>f.etiqueta),
    [{ label:'Visitantes', data: freqEdad.map(f=>f.frecAbs),
       backgroundColor: COLORES.slice(0, freqEdad.length), borderRadius:6, borderWidth:0 }]);

  crearGrafico('chart-edad-hist', 'bar', freqEdad.map(f=>f.etiqueta),
    [{ label:'Frecuencia relativa', data: freqEdad.map(f=>parseFloat(f.frecRel.toFixed(4))),
       backgroundColor:'#EF9F27', borderRadius:0, borderWidth:1, borderColor:'#854F0B' }]);

  // Gráficos procedencia: circular + barras
  crearGrafico('chart-proc-pie', 'pie', freqProc.map(f=>f.etiqueta),
    [{ data: freqProc.map(f=>f.frecAbs), backgroundColor: COLORES.slice(0, freqProc.length), borderWidth:0 }]);

  crearGrafico('chart-proc-bar', 'bar', freqProc.map(f=>f.etiqueta),
    [{ label:'Visitantes', data: freqProc.map(f=>f.frecAbs),
       backgroundColor: COLORES.slice(0, freqProc.length), borderRadius:6, borderWidth:0 }]);

  // Gráficos tipo: barras + doughnut
  crearGrafico('chart-tipo-bar', 'bar', freqTipo.map(f=>f.etiqueta),
    [{ label:'Visitantes', data: freqTipo.map(f=>f.frecAbs),
       backgroundColor: COLORES.slice(0, freqTipo.length), borderRadius:6, borderWidth:0 }]);

  crearGrafico('chart-tipo-pie', 'doughnut', freqTipo.map(f=>f.etiqueta),
    [{ data: freqTipo.map(f=>f.frecAbs), backgroundColor: COLORES.slice(0, freqTipo.length), borderWidth:0 }]);

  // Cruce inicial
  renderCruce();
}

// ===== ARRANQUE =====
if (sessionStorage.getItem(CLAVE_SESION) === 'true') {
  mostrarDashboard();
}

// ===== EXPONER FUNCIONES AL HTML (necesario con type="module") =====
window.verificarLogin  = verificarLogin;
window.cerrarSesion    = cerrarSesion;
window.mostrarTab      = mostrarTab;
window.renderCruce     = renderCruce;
window.exportarExcel   = exportarExcel;
window.limpiarDatos    = limpiarDatos;

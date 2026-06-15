// ============================================================
// DASHBOARD ESTADÍSTICO — Mariposas Amarillas
// Proyecto Final Estadística I — Universidad de La Guajira
// Autores: Jhonner Bernal, Dohard Correa, Diego Maldonado
// Descripción: Módulo principal del panel administrativo.
//   Lee datos del Google Sheets, calcula estadísticas y
//   renderiza KPIs, tablas, gráficos y cruces de variables.
// ============================================================

// ============================================================
// CONFIGURACIÓN — GOOGLE SHEETS
// El dashboard lee los datos directamente del Google Sheet
// donde Google Forms guarda las respuestas del formulario.
// ============================================================
const SHEET_ID  = '1oVAsoodAXiP9z4cZPn2_vYXBMrvIIz18XdhqVs9grKY'; // ID del Google Sheet
const SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`; // URL para exportar como CSV

// ============================================================
// AUTENTICACIÓN
// Sistema de login con contraseña para proteger el dashboard.
// Usa sessionStorage para mantener la sesión activa mientras
// el navegador está abierto, sin necesidad de base de datos.
// ============================================================
const PASSWORD_ADMIN = 'admin123';       // Contraseña del administrador
const CLAVE_SESION   = 'admin_mariposas'; // Clave usada en sessionStorage

/**
 * verificarLogin — Valida la contraseña ingresada.
 * Si es correcta, guarda la sesión y muestra el dashboard.
 * Si es incorrecta, muestra un mensaje de error.
 */
function verificarLogin() {
  const input = document.getElementById('campo-password').value; // Leer contraseña del campo
  const error = document.getElementById('error-msg');            // Elemento para mostrar error

  if (input === PASSWORD_ADMIN) {
    // Contraseña correcta: guardar sesión y entrar al dashboard
    sessionStorage.setItem(CLAVE_SESION, 'true');
    mostrarDashboard();
  } else {
    // Contraseña incorrecta: mostrar error y limpiar campo
    error.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
    document.getElementById('campo-password').value = '';
    document.getElementById('campo-password').focus();
  }
}

/**
 * cerrarSesion — Elimina la sesión y regresa a la pantalla de login.
 */
function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);                                    // Borrar sesión
  document.getElementById('dashboard-screen').classList.add('hidden');        // Ocultar dashboard
  document.getElementById('login-screen').classList.remove('hidden');         // Mostrar login
  document.getElementById('campo-password').value  = '';                      // Limpiar campo
  document.getElementById('error-msg').textContent = '';                      // Limpiar error
}

/**
 * mostrarDashboard — Oculta el login y muestra el panel.
 * Llama a init() para cargar y renderizar todos los datos.
 */
function mostrarDashboard() {
  document.getElementById('login-screen').classList.add('hidden');            // Ocultar login
  document.getElementById('dashboard-screen').classList.remove('hidden');     // Mostrar dashboard
  init();                                                                      // Cargar datos y gráficos
}

// ============================================================
// ESTADO GLOBAL
// DATOS_GLOBALES almacena todos los registros cargados desde
// Google Sheets. Se usa en renderCruce() y exportarExcel()
// sin necesidad de volver a llamar a la API.
// ============================================================
let DATOS_GLOBALES = [];

// ============================================================
// PALETA DE COLORES
// Colores del diseño del proyecto (amarillo/café guajiro).
// Se usan en todos los gráficos de Chart.js.
// ============================================================
const COLORES = [
  '#EF9F27', // Amarillo principal
  '#854F0B', // Café oscuro
  '#BA7517', // Café medio
  '#FAC775', // Amarillo claro
  '#633806', // Café muy oscuro
  '#1D9E75', // Verde acento
  '#412402', // Café casi negro
  '#5DCAA5', // Verde claro
  '#9FE1CB'  // Verde menta
];

// ============================================================
// ORDEN NATURAL DE LAS EDADES
// Google Forms puede guardar las opciones con o sin la palabra
// "años". Este arreglo cubre ambos formatos para ordenar
// correctamente las frecuencias de menor a mayor edad.
// ============================================================
const ORDEN_EDAD = [
  'Menor de 18', 'Menor de 18 años',
  '18 a 25',     '18 a 25 años',
  'Entre 18 y 25','Entre 18 y 25 años',
  '26 a 35',     '26 a 35 años',
  'Entre 26 y 35','Entre 26 y 35 años',
  '36 a 45',     '36 a 45 años',
  'Entre 36 y 45','Entre 36 y 45 años',
  '46 a 60',     '46 a 60 años',
  'Entre 46 y 60','Entre 46 y 60 años',
  'Mayor de 60', 'Mayor de 60 años'
];

// ============================================================
// CARGA DE DATOS DESDE GOOGLE SHEETS
// ============================================================

/**
 * cargarDatosFirebase — Descarga los datos del Google Sheet en
 * formato CSV y los convierte en un arreglo de objetos.
 *
 * El CSV exportado por Google tiene este formato:
 *   Marca de tiempo, Edad, Procedencia, Tipo de visitante
 *
 * Retorna: Array de objetos { id, fecha, hora, monumento,
 *                              edad, procedencia, tipo }
 * En caso de error, retorna un arreglo vacío [].
 */
async function cargarDatosFirebase() {
  try {
    const res  = await fetch(SHEET_CSV); // Descargar el CSV del Sheet
    const text = await res.text();       // Obtener el contenido como texto

    /**
     * parsearCSV — Convierte texto CSV a arreglo de arreglos.
     * Maneja correctamente campos entre comillas que contienen
     * comas internas (ej: "Otro municipio de La Guajira").
     */
    function parsearCSV(texto) {
      return texto.trim().split('\n').map(linea => {
        const campos = [];
        let actual = '';
        let dentroComillas = false;

        for (let i = 0; i < linea.length; i++) {
          const c = linea[i];
          if (c === '"') {
            // Alternar el estado dentro/fuera de comillas
            dentroComillas = !dentroComillas;
          } else if (c === ',' && !dentroComillas) {
            // Coma fuera de comillas = separador de campo
            campos.push(actual.trim());
            actual = '';
          } else {
            // Cualquier otro carácter se agrega al campo actual
            actual += c;
          }
        }
        campos.push(actual.trim()); // Agregar el último campo
        return campos;
      });
    }

    const filas = parsearCSV(text);
    if (filas.length < 2) return []; // Solo hay encabezado, sin datos

    // Convertir cada fila en un objeto de registro
    // Columnas Google Form: 0=Marca de tiempo, 1=Edad, 2=Procedencia, 3=Tipo
    return filas.slice(1).map((f, i) => {
      const ts     = f[0] || '';              // Marca de tiempo completa
      const partes = ts.split(' ');           // Separar fecha y hora
      return {
        id:          i + 1,                   // Número de registro secuencial
        fecha:       partes[0] || '',         // Fecha (primera parte del timestamp)
        hora:        partes[1] || '',         // Hora (segunda parte del timestamp)
        monumento:   'Mariposas Amarillas de Mauricio Babilonia',
        edad:        f[1] || '',              // Rango de edad seleccionado
        procedencia: f[2] || '',              // Lugar de procedencia
        tipo:        f[3] || ''               // Tipo de visitante
      };
    }).filter(r => r.edad && r.procedencia && r.tipo); // Descartar filas incompletas

  } catch (e) {
    // Si hay error de red o de parseo, registrar en consola y retornar vacío
    console.error('Error leyendo Google Sheets:', e);
    return [];
  }
}

// ============================================================
// CÁLCULO DE FRECUENCIAS
// ============================================================

/**
 * calcularFrecuencias — Genera una tabla de frecuencias para
 * una variable categórica del conjunto de datos.
 *
 * @param {Array}  datos  - Arreglo de registros de visitas
 * @param {string} campo  - Nombre del campo a analizar ('edad', 'procedencia', 'tipo')
 * @param {Array}  orden  - (opcional) Arreglo que define el orden de las categorías
 *
 * Retorna: Array de objetos con { etiqueta, frecAbs, frecRel, porcentaje }
 */
function calcularFrecuencias(datos, campo, orden) {
  // Contar ocurrencias de cada valor
  const conteo = {};
  datos.forEach(r => {
    const val = r[campo] || 'Sin dato';
    conteo[val] = (conteo[val] || 0) + 1;
  });

  const total = datos.length;

  // Convertir el conteo en arreglo con todas las medidas
  let entradas = Object.entries(conteo).map(([etiqueta, frec]) => ({
    etiqueta,
    frecAbs:    frec,                                                           // Frecuencia absoluta
    frecRel:    total > 0 ? frec / total : 0,                                  // Frecuencia relativa
    porcentaje: total > 0 ? ((frec / total) * 100).toFixed(1) : '0.0'         // Porcentaje
  }));

  // Ordenar según el arreglo de orden provisto, o por frecuencia descendente
  if (orden) {
    entradas.sort((a, b) => orden.indexOf(a.etiqueta) - orden.indexOf(b.etiqueta));
  } else {
    entradas.sort((a, b) => b.frecAbs - a.frecAbs);
  }

  return entradas;
}

// ============================================================
// MEDIDAS ESTADÍSTICAS DE TENDENCIA CENTRAL
// Para la variable EDAD (categórica por rangos) se usa el
// punto medio de cada intervalo para calcular media y mediana.
// ============================================================

/**
 * PUNTO_MEDIO — Asigna un valor numérico representativo a cada
 * rango de edad, necesario para calcular media y mediana.
 * Se incluyen ambos formatos (con y sin "años") por compatibilidad
 * con distintas versiones del formulario de Google Forms.
 */
const PUNTO_MEDIO = {
  'Menor de 18 años': 14,
  'Entre 18 y 25 años': 21.5,
  'Entre 26 y 35 años': 30.5,
  'Entre 36 y 45 años': 40.5,
  'Entre 46 y 60 años': 53,
  'Mayor de 60 años': 65
};
/**
 * calcularModa — Retorna la categoría con mayor frecuencia absoluta.
 * @param {Array} frecuencias - Resultado de calcularFrecuencias()
 */
function calcularModa(frecuencias) {
  if (!frecuencias.length) return '—';
  return frecuencias.slice().sort((a, b) => b.frecAbs - a.frecAbs)[0].etiqueta;
}

/**
 * calcularMediaEdad — Calcula la media aritmética de la edad
 * usando el punto medio de cada rango como valor representativo.
 * Fórmula: Media = Σ(punto_medio × frecuencia) / N
 *
 * @param {Array} datos - Arreglo de registros de visitas
 */
function calcularMediaEdad(datos) {
  if (!datos.length) return '—';
  const vals = datos
    .map(r => PUNTO_MEDIO[r.edad] || 0)  // Convertir rango a número
    .filter(v => v > 0);                  // Descartar registros sin punto medio
  if (!vals.length) return '—';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

/**
 * calcularMedianaEdad — Calcula la mediana de la edad usando los
 * puntos medios. Ordena los valores y toma el valor central.
 * Si hay número par de datos, promedia los dos centrales.
 *
 * @param {Array} datos - Arreglo de registros de visitas
 */
function calcularMedianaEdad(datos) {
  if (!datos.length) return '—';
  const conteo = {};
  datos.forEach(r => {
    const edad = (r.edad || '').trim();
    if (edad) conteo[edad] = (conteo[edad] || 0) + 1;
  });
  if (!Object.keys(conteo).length) return '—';
  const moda = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];
  return PUNTO_MEDIO[moda] !== undefined ? PUNTO_MEDIO[moda].toFixed(1) : '—';
}

// ============================================================
// SECCIÓN ① — KPIs (Indicadores Clave de Desempeño)
// Muestra los 5 indicadores principales en tarjetas resumen.
// ============================================================

/**
 * renderKPIs — Genera y muestra las tarjetas de indicadores
 * en el elemento con id 'kpi-grid'.
 * @param {Array} datos - Arreglo de registros de visitas
 */
function renderKPIs(datos) {
  const el = document.getElementById('kpi-grid');

  // Si no hay datos, mostrar mensaje informativo
  if (!datos.length) {
    el.innerHTML = '<p class="empty-state">Aún no hay registros. Escanea el QR para comenzar.</p>';
    return;
  }

  // Calcular frecuencias para obtener modas
  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const freqProc = calcularFrecuencias(datos, 'procedencia');
  const freqTipo = calcularFrecuencias(datos, 'tipo');

  // Definir los 5 KPIs a mostrar
  const kpis = [
    { num: datos.length,              label: 'Total de visitas' },
    { num: 1,                          label: 'Monumentos registrados' },
    { num: calcularModa(freqEdad),     label: 'Grupo etario predominante' },
    { num: calcularModa(freqProc),     label: 'Procedencia predominante' },
    { num: calcularModa(freqTipo),     label: 'Tipo de visitante predominante' },
  ];

  // Renderizar cada KPI como una tarjeta HTML
  el.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-num">${k.num}</div>
      <div class="kpi-label">${k.label}</div>
    </div>`).join('');
}

// ============================================================
// SECCIÓN ② — MEDIDAS ESTADÍSTICAS
// Muestra media, mediana, moda y N total en tarjetas.
// ============================================================

/**
 * renderMedidas — Calcula y muestra las medidas de tendencia
 * central para la variable edad en el elemento 'medidas-edad'.
 * @param {Array} datos - Arreglo de registros de visitas
 */
function renderMedidas(datos) {
  const el = document.getElementById('medidas-edad');
  if (!datos.length) { el.innerHTML = ''; return; }

  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const media    = calcularMediaEdad(datos);
  const mediana  = calcularMedianaEdad(datos);
  const moda     = calcularModa(freqEdad);

  // Arreglo de medidas a mostrar
  const cards = [
    { num: media,        lbl: 'Media (punto medio)' },
    { num: mediana,      lbl: 'Mediana (punto medio)' },
    { num: moda,         lbl: 'Moda (rango más frecuente)' },
    { num: datos.length, lbl: 'N total' },
  ];

  // Renderizar cada medida como tarjeta
  el.innerHTML = cards.map(c => `
    <div class="medida-card">
      <div class="medida-num">${c.num}</div>
      <div class="medida-lbl">${c.lbl}</div>
    </div>`).join('');
}

// ============================================================
// SECCIÓN ③ — TABLAS DE FRECUENCIA
// ============================================================

/**
 * renderTabla — Genera una tabla HTML de frecuencias absolutas,
 * relativas y porcentajes para la variable indicada.
 *
 * @param {string} id          - ID del elemento donde se insertará la tabla
 * @param {Array}  frecuencias - Resultado de calcularFrecuencias()
 */
function renderTabla(id, frecuencias) {
  const el = document.getElementById(id);
  if (!frecuencias.length) {
    el.innerHTML = '<p class="empty-state">Sin datos aún.</p>';
    return;
  }

  // Construir filas de la tabla
  const filas = frecuencias.map(f => `
    <tr>
      <td>${f.etiqueta}</td>
      <td style="text-align:center;">${f.frecAbs}</td>
      <td style="text-align:center;">${f.frecRel.toFixed(4)}</td>
      <td style="text-align:center;">${f.porcentaje}%</td>
    </tr>`).join('');

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Frec. absoluta</th>
          <th>Frec. relativa</th>
          <th>Porcentaje</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// ============================================================
// GRÁFICOS — Chart.js
// Objeto 'graficos' almacena las instancias activas de Chart.js
// para poder destruirlas antes de crear una nueva versión
// (evita el error "Canvas already in use").
// ============================================================
const graficos = {};

/**
 * crearGrafico — Crea o reemplaza un gráfico Chart.js en el canvas indicado.
 *
 * @param {string} id       - ID del elemento canvas
 * @param {string} tipo     - Tipo de gráfico: 'bar', 'pie', 'doughnut'
 * @param {Array}  labels   - Etiquetas del eje X (o sectores del pie)
 * @param {Array}  datasets - Datos y estilos de cada serie
 * @param {Object} opciones - Opciones adicionales (leyenda, escalas, etc.)
 */
function crearGrafico(id, tipo, labels, datasets, opciones = {}) {
  // Destruir gráfico anterior si existe para liberar el canvas
  if (graficos[id]) graficos[id].destroy();

  const ctx = document.getElementById(id);
  if (!ctx) return; // El canvas no existe en el DOM actual

  graficos[id] = new Chart(ctx.getContext('2d'), {
    type: tipo,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        // Mostrar leyenda solo en gráficos circulares o cuando se pide explícitamente
        legend:  { display: tipo === 'pie' || tipo === 'doughnut' || !!opciones.leyenda },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw} visitantes` } }
      },
      // Configurar escala Y solo para gráficos de barras
      scales: (tipo === 'bar' || tipo === 'histogram') ? {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      } : {},
      ...opciones.extra // Opciones adicionales opcionales
    }
  });
}

// ============================================================
// TABLA DE REGISTROS
// ============================================================

/**
 * renderRegistros — Genera la tabla completa de todos los
 * registros individuales de visitas.
 * @param {Array} datos - Arreglo de registros de visitas
 */
function renderRegistros(datos) {
  const el = document.getElementById('tabla-registros');
  if (!datos.length) {
    el.innerHTML = '<p class="empty-state">Sin registros aún.</p>';
    return;
  }

  // Una fila por cada registro con número, fecha, hora y variables
  const filas = datos.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.fecha}</td>
      <td>${r.hora}</td>
      <td>${r.edad}</td>
      <td>${r.procedencia}</td>
      <td>${r.tipo}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="min-width:500px;">
        <thead>
          <tr>
            <th>#</th><th>Fecha</th><th>Hora</th>
            <th>Edad</th><th>Procedencia</th><th>Tipo</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// ============================================================
// SECCIÓN ④ — CRUCE DE VARIABLES (Tablas de Contingencia)
// Permite analizar la relación entre dos variables categóricas.
// Lee el valor del selector y construye la tabla y el gráfico.
// ============================================================

/**
 * renderCruce — Construye la tabla de contingencia y el gráfico
 * comparativo para el par de variables seleccionado en el
 * elemento 'cruce-selector'.
 *
 * Casos disponibles:
 *   edad_procedencia      → Edad vs Procedencia
 *   edad_tipo             → Edad vs Tipo de visitante
 *   procedencia_tipo      → Procedencia vs Tipo de visitante
 *   monumento_procedencia → Monumento vs Procedencia (fila fija)
 *   monumento_edad        → Monumento vs Edad (fila fija)
 */
function renderCruce() {
  const datos = DATOS_GLOBALES; // Usar los datos ya cargados globalmente
  const sel   = document.getElementById('cruce-selector').value;

  // ── Caso especial: Monumento como dimensión de fila ──────
  // Como solo hay un monumento (Mariposas Amarillas), la tabla
  // tiene una sola fila y las columnas son los valores de la
  // segunda variable.
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

    // Construir encabezados y celdas de la tabla
    const enc2    = valsCol2.map(c => `<th>${c}</th>`).join('');
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

    // Gráfico de barras para el cruce con monumento
    crearGrafico('chart-cruce', 'bar', valsCol2,
      [{ label: nomMon,
         data: valsCol2.map(c => { const f = freqCol.find(x => x.etiqueta === c); return f ? f.frecAbs : 0; }),
         backgroundColor: COLORES.slice(0, valsCol2.length),
         borderRadius: 6, borderWidth: 0 }],
      { leyenda: false });
    return;
  }

  // ── Caso general: cruce entre dos variables ──────────────
  // Determinar qué campo va en filas y cuál en columnas
  let campoFila, campoCol;
  if (sel === 'edad_procedencia') { campoFila = 'edad';        campoCol = 'procedencia'; }
  if (sel === 'edad_tipo')        { campoFila = 'edad';        campoCol = 'tipo'; }
  if (sel === 'procedencia_tipo') { campoFila = 'procedencia'; campoCol = 'tipo'; }

  // Obtener valores únicos respetando el orden natural de las edades
  const valsFila = [...new Set(datos.map(r => r[campoFila]))].sort((a, b) => {
    if (campoFila === 'edad') {
      const ia = ORDEN_EDAD.indexOf(a);
      const ib = ORDEN_EDAD.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }
    return a.localeCompare(b); // Orden alfabético para otras variables
  });
  const valsCol = [...new Set(datos.map(r => r[campoCol]))].sort();

  if (!valsFila.length || !valsCol.length) {
    document.getElementById('tabla-cruce').innerHTML = '<p class="empty-state">Sin datos aún.</p>';
    return;
  }

  // Construir la matriz de contingencia (tabla cruzada)
  // matriz[valorFila][valorCol] = cantidad de registros con esa combinación
  const matriz = {};
  valsFila.forEach(f => {
    matriz[f] = {};
    valsCol.forEach(c => { matriz[f][c] = 0; }); // Inicializar en 0
  });
  datos.forEach(r => {
    // Incrementar el conteo para la combinación del registro
    if (matriz[r[campoFila]] !== undefined)
      matriz[r[campoFila]][r[campoCol]] = (matriz[r[campoFila]][r[campoCol]] || 0) + 1;
  });

  // Construir HTML de la tabla de contingencia
  const encabezados = valsCol.map(c => `<th>${c}</th>`).join('');
  const filas = valsFila.map(f => {
    const celdas = valsCol.map(c =>
      `<td style="text-align:center;">${matriz[f][c] || 0}</td>`
    ).join('');
    return `<tr><td><strong>${f}</strong></td>${celdas}</tr>`;
  }).join('');

  document.getElementById('tabla-cruce').innerHTML = `
    <div style="overflow-x:auto; margin-bottom:1rem;">
      <table style="min-width:400px;">
        <thead><tr><th>${campoFila} / ${campoCol}</th>${encabezados}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;

  // Gráfico de barras agrupadas: una serie por cada valor de la columna
  const datasets = valsCol.map((col, i) => ({
    label: col,
    data:  valsFila.map(f => matriz[f][col] || 0), // Valores de cada fila para esta columna
    backgroundColor: COLORES[i % COLORES.length],
    borderRadius: 5,
    borderWidth: 0
  }));

  crearGrafico('chart-cruce', 'bar', valsFila, datasets, { leyenda: true });
}

// ============================================================
// NAVEGACIÓN POR PESTAÑAS (TABS)
// ============================================================

/**
 * mostrarTab — Muestra la pestaña indicada y oculta las demás.
 * @param {string} nombre - Nombre de la pestaña ('edad', 'procedencia', 'tipo', 'registros')
 * @param {Event}  event  - Evento del click para marcar el botón como activo
 */
function mostrarTab(nombre, event) {
  // Ocultar todas las pestañas
  ['edad', 'procedencia', 'tipo', 'registros'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
  });
  // Mostrar la pestaña seleccionada
  document.getElementById(`tab-${nombre}`).classList.remove('hidden');
  // Actualizar estado visual de los botones de pestaña
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
}

// ============================================================
// EXPORTAR A EXCEL DETALLADO CON GRÁFICOS
// Genera un archivo .xlsx con múltiples hojas:
//   📊 Resumen General, 📋 Registros,
//   👤 Edad, 📍 Procedencia, 🪪 Tipo Visitante,
//   🔀 Cruces de variables (5 hojas)
// Usa la librería SheetJS (XLSX) cargada desde CDN.
// ============================================================

/**
 * exportarExcel — Genera y descarga el archivo Excel completo.
 * Es async porque captura los gráficos del canvas (necesita
 * esperar a que Chart.js renderice en los tabs ocultos).
 */
async function exportarExcel() {
  const datos = DATOS_GLOBALES;
  if (!datos.length) { alert('No hay datos para exportar aún.'); return; }

  // Hacer visibles todos los tabs para que Chart.js renderice los canvas
  ['edad', 'procedencia', 'tipo', 'registros'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.remove('hidden');
  });
  // Esperar a que los gráficos se rendericen
  await new Promise(r => setTimeout(r, 150));

  const wb    = XLSX.utils.book_new(); // Crear libro de Excel vacío
  const total = datos.length;

  // Calcular frecuencias para todas las variables
  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const freqProc = calcularFrecuencias(datos, 'procedencia');
  const freqTipo = calcularFrecuencias(datos, 'tipo');

  // ── Estilos de celda reutilizables ──────────────────────
  // Se define el borde, relleno y fuente para cada tipo de celda
  const BORDER = {
    top:    { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left:   { style: 'thin', color: { rgb: 'CCCCCC' } },
    right:  { style: 'thin', color: { rgb: 'CCCCCC' } }
  };

  /**
   * cell — Crea un objeto de celda de SheetJS con estilo aplicado.
   * @param {*}      v         - Valor de la celda
   * @param {string} fill      - Color de relleno en hex (sin #)
   * @param {string} fontColor - Color de fuente en hex (sin #)
   * @param {bool}   bold      - Negrita
   * @param {string} align     - Alineación horizontal
   */
  function cell(v, fill, fontColor, bold = false, align = 'center') {
    return {
      v,
      t: typeof v === 'number' ? 'n' : 's', // Tipo: número o string
      s: {
        fill:      { patternType: 'solid', fgColor: { rgb: fill } },
        font:      { color: { rgb: fontColor }, bold, sz: 10 },
        border:    BORDER,
        alignment: { horizontal: align, vertical: 'center', wrapText: true }
      }
    };
  }

  // Funciones auxiliares para los tipos de celda más usados
  const H1  = (v) => cell(v, '854F0B', 'FFFFFF', true,  'center'); // Encabezado café oscuro
  const H2  = (v) => cell(v, 'EF9F27', 'FFFFFF', true,  'center'); // Encabezado amarillo
  const H3  = (v) => cell(v, 'FAEEDA', '412402', true,  'center'); // Sub-encabezado crema
  const D   = (v, al = 'center') => cell(v, 'FFFFFF', '444444', false, al); // Dato normal
  const DA  = (v, al = 'center') => cell(v, 'FFF8EC', '444444', false, al); // Dato alternado
  const TOT = (v) => cell(v, 'FAEEDA', '412402', true,  'center'); // Fila de total

  /**
   * setCells — Inserta múltiples celdas en una hoja y actualiza
   * el rango !ref de la hoja automáticamente.
   * @param {Object} ws  - Hoja de SheetJS
   * @param {Array}  arr - Arreglo de [referencia, celda]
   */
  function setCells(ws, arr) {
    arr.forEach(([ref, c]) => { ws[ref] = c; });
    const refs = arr.map(([r]) => r);
    const cols = refs.map(r => r.charCodeAt(0) - 65);
    const rows = refs.map(r => parseInt(r.slice(1)) - 1);
    const maxC = Math.max(...cols);
    const maxR = Math.max(...rows);
    if (!ws['!ref']) {
      ws['!ref'] = `A1:${String.fromCharCode(65 + maxC)}${maxR + 1}`;
    } else {
      const cur = XLSX.utils.decode_range(ws['!ref']);
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(cur.e.r, maxR), c: Math.max(cur.e.c, maxC) }
      });
    }
  }

  /**
   * canvasImagen — Captura el canvas indicado como imagen PNG en base64.
   * @param {string} id - ID del elemento canvas
   * @returns {string|null} - Base64 de la imagen, o null si falla
   */
  function canvasImagen(id) {
    const c = document.getElementById(id);
    if (!c) return null;
    try { return c.toDataURL('image/png').split(',')[1]; } catch (e) { return null; }
  }

  /**
   * insertarImagen — Inserta una imagen PNG en una hoja de Excel.
   * @param {Object} wb     - Libro de Excel
   * @param {string} wsName - Nombre de la hoja
   * @param {string} b64    - Imagen en base64
   * @param {number} col    - Columna de inicio
   * @param {number} row    - Fila de inicio
   * @param {number} ancho  - Ancho en píxeles
   * @param {number} alto   - Alto en píxeles
   */
  function insertarImagen(wb, wsName, b64, col, row, ancho, alto) {
    if (!b64) return;
    if (!wb.Sheets[wsName]['!images']) wb.Sheets[wsName]['!images'] = [];
    wb.Sheets[wsName]['!images'].push({
      '!pos':      { r: row, c: col, x: 0, y: 0, w: ancho, h: alto },
      '!datatype': 'base64',
      '!data':     b64,
      '!type':     'png'
    });
  }

  // ── HOJA 1: RESUMEN GENERAL ────────────────────────────
  const ws1 = {};
  setCells(ws1, [
    ['A1', H1('SISTEMA INTELIGENTE DE INFORMACIÓN TURÍSTICA — MARIPOSAS AMARILLAS')],
    ['A2', H2('Monumento: Mariposas Amarillas · Riohacha, La Guajira')],
    ['A3', D('Exportado el: ' + new Date().toLocaleString('es-CO'))],
    ['A5', H2('INDICADORES GENERALES')],
    ['A6', H3('Indicador')],  ['B6', H3('Valor')],
    ['A7',  D('Total de visitas', 'left')],                      ['B7',  D(total)],
    ['A8',  D('Monumento', 'left')],                             ['B8',  D('Mariposas Amarillas')],
    ['A9',  D('Grupo etario predominante', 'left')],             ['B9',  D(calcularModa(freqEdad))],
    ['A10', D('Procedencia predominante', 'left')],              ['B10', D(calcularModa(freqProc))],
    ['A11', D('Tipo de visitante predominante', 'left')],        ['B11', D(calcularModa(freqTipo))],
    ['A13', H2('MEDIDAS ESTADÍSTICAS — EDAD')],
    ['A14', H3('Medida')], ['B14', H3('Valor')], ['C14', H3('Descripción')],
    ['A15', D('Media',   'left')], ['B15', D(parseFloat(calcularMediaEdad(datos)))],   ['C15', D('Promedio ponderado por punto medio de rango', 'left')],
    ['A16', D('Mediana', 'left')], ['B16', D(parseFloat(calcularMedianaEdad(datos)))], ['C16', D('Valor central de la distribución', 'left')],
    ['A17', D('Moda',    'left')], ['B17', D(calcularModa(freqEdad))],                 ['C17', D('Rango de edad con mayor frecuencia', 'left')],
    ['A18', D('N total', 'left')], ['B18', D(total)],                                  ['C18', D('Número total de registros', 'left')],
  ]);
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },  // Título principal
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },  // Subtítulo
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },  // Fecha
    { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },  // Sección indicadores
    { s: { r: 12, c: 0 }, e: { r: 12, c: 2 } } // Sección medidas
  ];
  ws1['!cols'] = [{ wch: 40 }, { wch: 24 }, { wch: 42 }];
  ws1['!rows'] = Array(18).fill({ hpt: 20 });
  ws1['!rows'][0] = { hpt: 28 };
  XLSX.utils.book_append_sheet(wb, ws1, '📊 Resumen');

  // ── HOJA 2: REGISTROS ──────────────────────────────────
  const ws2 = {};
  const refsReg = [
    ['A1', H1('REGISTROS DE VISITAS — Monumento Mariposas Amarillas')],
    ['A2', H2('#')], ['B2', H2('Fecha')], ['C2', H2('Hora')],
    ['D2', H2('Edad')], ['E2', H2('Procedencia')], ['F2', H2('Tipo de visitante')],
  ];
  // Una fila por cada registro, con filas alternadas para legibilidad
  datos.forEach((r, i) => {
    const row = i + 3;
    const fn  = i % 2 === 0 ? D : DA; // Alternar color de fila
    refsReg.push(
      [`A${row}`, fn(i + 1)],
      [`B${row}`, fn(r.fecha,       'left')],
      [`C${row}`, fn(r.hora)],
      [`D${row}`, fn(r.edad,        'left')],
      [`E${row}`, fn(r.procedencia, 'left')],
      [`F${row}`, fn(r.tipo,        'left')]
    );
  });
  setCells(ws2, refsReg);
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  ws2['!cols']   = [{ wch: 5 }, { wch: 13 }, { wch: 9 }, { wch: 18 }, { wch: 32 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, '📋 Registros');

  // ── FUNCIÓN PARA HOJAS DE FRECUENCIA ──────────────────
  /**
   * hojaFreq — Crea una hoja de frecuencias con tabla e imágenes
   * de gráficos capturadas desde los canvas del dashboard.
   *
   * @param {Array}  freq      - Resultado de calcularFrecuencias()
   * @param {string} nombre    - Nombre de la hoja en Excel
   * @param {string} titulo    - Título del encabezado
   * @param {Array}  canvasIds - IDs de los canvas a capturar como imagen
   */
  function hojaFreq(freq, nombre, titulo, canvasIds) {
    const ws   = {};
    let   acum = 0;
    const refs = [
      ['A1', H1(titulo)],
      ['A3', H2('TABLA DE FRECUENCIAS')],
      ['A4', H3('Categoría')], ['B4', H3('Frec. Absoluta')],
      ['C4', H3('Frec. Relativa')], ['D4', H3('Porcentaje (%)')], ['E4', H3('Acumulada (%)')],
    ];

    // Filas de datos con porcentaje acumulado
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

    // Fila de totales
    const totalRow = freq.length + 5;
    refs.push(
      [`A${totalRow}`, TOT('TOTAL')], [`B${totalRow}`, TOT(total)],
      [`C${totalRow}`, TOT(1.0)],     [`D${totalRow}`, TOT(100.0)], [`E${totalRow}`, TOT('')]
    );

    // Sección de interpretación estadística
    const iRow = totalRow + 2;
    refs.push(
      [`A${iRow}`,     H2('INTERPRETACIÓN')],
      [`A${iRow + 1}`, D('Moda', 'left')],
      [`B${iRow + 1}`, D(calcularModa(freq), 'left')],
      [`A${iRow + 2}`, D('Mayor frecuencia', 'left')],
      [`B${iRow + 2}`, D(freq.slice().sort((a, b) => b.frecAbs - a.frecAbs)[0]?.etiqueta || '—', 'left')],
      [`A${iRow + 3}`, D('Menor frecuencia', 'left')],
      [`B${iRow + 3}`, D(freq.slice().sort((a, b) => a.frecAbs - b.frecAbs)[0]?.etiqueta || '—', 'left')]
    );

    setCells(ws, refs);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
      { s: { r: iRow - 1, c: 0 }, e: { r: iRow - 1, c: 4 } }
    ];
    ws['!cols'] = [{ wch: 32 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 17 }];
    XLSX.utils.book_append_sheet(wb, ws, nombre);

    // Insertar capturas de los gráficos correspondientes
    const imgRow = iRow + 5;
    canvasIds.forEach((cid, idx) => {
      const img = canvasImagen(cid);
      if (img) insertarImagen(wb, nombre, img, idx * 4, imgRow, 480, 300);
    });
  }

  hojaFreq(freqEdad, '👤 Edad',          'DISTRIBUCIÓN POR EDAD',            ['chart-edad-bar', 'chart-edad-hist']);
  hojaFreq(freqProc, '📍 Procedencia',   'DISTRIBUCIÓN POR PROCEDENCIA',     ['chart-proc-bar', 'chart-proc-pie']);
  hojaFreq(freqTipo, '🪪 Tipo Visitante','DISTRIBUCIÓN POR TIPO VISITANTE',  ['chart-tipo-bar', 'chart-tipo-pie']);

  // ── FUNCIÓN PARA HOJAS DE CRUCE ───────────────────────
  /**
   * hojaCruce — Crea una hoja de contingencia para el cruce
   * de dos variables categóricas, con imagen del gráfico.
   */
  function hojaCruce(campoFila, campoCol, ordenFila, nombre, titulo) {
    // Obtener valores únicos de cada variable respetando el orden
    const valsFila = ordenFila
      ? ordenFila.filter(v => datos.some(r => r[campoFila] === v))
      : [...new Set(datos.map(r => r[campoFila]))].sort();
    const valsCol  = [...new Set(datos.map(r => r[campoCol]))].sort();

    // Construir la matriz de contingencia
    const matriz = {};
    valsFila.forEach(f => { matriz[f] = {}; valsCol.forEach(c => { matriz[f][c] = 0; }); });
    datos.forEach(r => {
      if (matriz[r[campoFila]] !== undefined)
        matriz[r[campoFila]][r[campoCol]] = (matriz[r[campoFila]][r[campoCol]] || 0) + 1;
    });

    const colLetras = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, valsCol.length);
    const totCol    = String.fromCharCode(66 + valsCol.length);
    const ws        = {};
    const refs      = [['A1', H1(titulo)], ['A3', H2('TABLA DE CONTINGENCIA')]];

    // Encabezado de columnas
    refs.push(['A4', H3(`${campoFila} \\ ${campoCol}`)]);
    valsCol.forEach((c, i) => refs.push([`${colLetras[i]}4`, H3(c)]));
    refs.push([`${totCol}4`, H3('TOTAL')]);

    // Filas de datos con totales por fila
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

    // Fila de totales por columna
    const totalRow = valsFila.length + 5;
    refs.push([`A${totalRow}`, TOT('TOTAL')]);
    valsCol.forEach((c, ci) => {
      const v = valsFila.reduce((s, f) => s + (matriz[f][c] || 0), 0);
      refs.push([`${colLetras[ci]}${totalRow}`, TOT(v)]);
    });
    refs.push([`${totCol}${totalRow}`, TOT(total)]);

    setCells(ws, refs);
    const mergeEnd = valsCol.length + 1;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: mergeEnd } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: mergeEnd } }
    ];
    ws['!cols'] = [{ wch: 28 }, ...valsCol.map(() => ({ wch: 18 })), { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }

  /**
   * capturaGraficoCruce — Selecciona un cruce en el selector,
   * espera a que Chart.js lo renderice y captura el canvas.
   */
  async function capturaGraficoCruce(valor) {
    document.getElementById('cruce-selector').value = valor;
    renderCruce();
    await new Promise(r => setTimeout(r, 200)); // Esperar renderizado
    return canvasImagen('chart-cruce');
  }

  // Capturar imágenes de los 5 cruces disponibles
  const imgEdadProc = await capturaGraficoCruce('edad_procedencia');
  const imgEdadTipo = await capturaGraficoCruce('edad_tipo');
  const imgProcTipo = await capturaGraficoCruce('procedencia_tipo');
  const imgMonProc  = await capturaGraficoCruce('monumento_procedencia');
  const imgMonEdad  = await capturaGraficoCruce('monumento_edad');

  // Crear hojas de cruce
  hojaCruce('edad',         'procedencia', ORDEN_EDAD, '🔀 Edad vs Procedencia',    'CRUCE: EDAD vs PROCEDENCIA');
  hojaCruce('edad',         'tipo',        ORDEN_EDAD, '🔀 Edad vs Tipo',           'CRUCE: EDAD vs TIPO DE VISITANTE');
  hojaCruce('procedencia',  'tipo',        null,       '🔀 Procedencia vs Tipo',    'CRUCE: PROCEDENCIA vs TIPO VISITANTE');

  // Insertar imágenes de los cruces en sus hojas correspondientes
  const cruceSheets = ['🔀 Edad vs Procedencia', '🔀 Edad vs Tipo', '🔀 Procedencia vs Tipo'];
  const cruceImgs   = [imgEdadProc, imgEdadTipo, imgProcTipo];
  cruceSheets.forEach((sh, i) => {
    if (cruceImgs[i] && wb.Sheets[sh]) {
      if (!wb.Sheets[sh]['!images']) wb.Sheets[sh]['!images'] = [];
      wb.Sheets[sh]['!images'].push({
        '!pos':      { r: 20, c: 0, x: 0, y: 0, w: 600, h: 320 },
        '!datatype': 'base64', '!data': cruceImgs[i], '!type': 'png'
      });
    }
  });

  /**
   * hojaMonumento — Crea la hoja de cruce Monumento vs Variable,
   * donde la fila es siempre "Mariposas Amarillas".
   */
  function hojaMonumento(campoCol, ordenCol, nombre, titulo, imgB64) {
    const freq    = calcularFrecuencias(datos, campoCol, ordenCol);
    const valsCol = freq.map(f => f.etiqueta);
    const colLetras = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, valsCol.length);
    const totCol    = String.fromCharCode(66 + valsCol.length);
    const ws   = {};
    const refs = [
      ['A1', H1(titulo)],
      ['A3', H2('TABLA DE CONTINGENCIA')],
      ['A4', H3(`Monumento \\ ${campoCol}`)]
    ];
    valsCol.forEach((c, i) => refs.push([`${colLetras[i]}4`, H3(c)]));
    refs.push([`${totCol}4`, H3('TOTAL')]);

    // Fila de datos (solo una fila = un monumento)
    refs.push(['A5', D('Mariposas Amarillas', 'left')]);
    valsCol.forEach((c, i) => {
      const f = freq.find(x => x.etiqueta === c);
      refs.push([`${colLetras[i]}5`, D(f ? f.frecAbs : 0)]);
    });
    refs.push([`${totCol}5`, TOT(total)]);

    // Fila de totales
    refs.push(['A6', TOT('TOTAL')]);
    valsCol.forEach((c, i) => {
      const f = freq.find(x => x.etiqueta === c);
      refs.push([`${colLetras[i]}6`, TOT(f ? f.frecAbs : 0)]);
    });
    refs.push([`${totCol}6`, TOT(total)]);

    setCells(ws, refs);
    const mergeEnd = valsCol.length + 1;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: mergeEnd } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: mergeEnd } }
    ];
    ws['!cols'] = [{ wch: 28 }, ...valsCol.map(() => ({ wch: 18 })), { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, nombre);

    // Insertar imagen del gráfico correspondiente
    if (imgB64 && wb.Sheets[nombre]) {
      if (!wb.Sheets[nombre]['!images']) wb.Sheets[nombre]['!images'] = [];
      wb.Sheets[nombre]['!images'].push({
        '!pos':      { r: 8, c: 0, x: 0, y: 0, w: 600, h: 320 },
        '!datatype': 'base64', '!data': imgB64, '!type': 'png'
      });
    }
  }

  hojaMonumento('procedencia', null,       '🔀 Monumento vs Procedencia', 'CRUCE: MONUMENTO vs PROCEDENCIA', imgMonProc);
  hojaMonumento('edad',        ORDEN_EDAD, '🔀 Monumento vs Edad',        'CRUCE: MONUMENTO vs EDAD',        imgMonEdad);

  // Restaurar visibilidad de tabs (ocultar los que no son el activo)
  ['procedencia', 'tipo', 'registros'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
  });

  // Generar nombre del archivo con fecha y descargar
  const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
  XLSX.writeFile(wb, `estadisticas_mariposas_${fecha}.xlsx`);
}

// ============================================================
// LIMPIAR DATOS
// Como los datos están en Google Sheets, no se pueden borrar
// directamente desde la página. Se redirige al Sheet.
// ============================================================

/**
 * limpiarDatos — Ofrece abrir el Google Sheet para borrar
 * registros manualmente desde ahí.
 */
function limpiarDatos() {
  if (confirm('Para eliminar registros debes hacerlo directamente en el Google Sheet. ¿Quieres abrirlo ahora?')) {
    window.open('https://docs.google.com/spreadsheets/d/' + SHEET_ID, '_blank');
  }
}

// ============================================================
// INICIALIZACIÓN DEL DASHBOARD
// Carga los datos del Sheet y renderiza todos los componentes.
// ============================================================

/**
 * init — Función principal de carga del dashboard.
 * Es asíncrona porque espera la respuesta de Google Sheets.
 * Renderiza en orden: KPIs → Medidas → Tablas → Gráficos → Cruce.
 */
async function init() {
  if (!sessionStorage.getItem(CLAVE_SESION)) return; // Verificar sesión activa

  // Mostrar indicador de carga mientras se obtienen los datos
  document.getElementById('kpi-grid').innerHTML =
    '<p class="empty-state">⏳ Cargando datos desde Google Sheets…</p>';

  // Descargar y parsear datos del Google Sheet
  const datos    = await cargarDatosFirebase();
  DATOS_GLOBALES = datos; // Guardar en variable global para uso en otros módulos

  // Renderizar secciones del dashboard
  renderKPIs(datos);
  renderMedidas(datos);

  // Calcular frecuencias para todas las variables
  const freqEdad = calcularFrecuencias(datos, 'edad', ORDEN_EDAD);
  const freqProc = calcularFrecuencias(datos, 'procedencia');
  const freqTipo = calcularFrecuencias(datos, 'tipo');

  // Tablas de frecuencia para cada variable
  renderTabla('tabla-edad',        freqEdad);
  renderTabla('tabla-procedencia', freqProc);
  renderTabla('tabla-tipo',        freqTipo);
  renderRegistros(datos);

  // ── Gráficos de Edad ──────────────────────────────────
  // Barras: frecuencia absoluta por rango de edad
  crearGrafico('chart-edad-bar', 'bar', freqEdad.map(f => f.etiqueta), [{
    label:           'Visitantes',
    data:            freqEdad.map(f => f.frecAbs),
    backgroundColor: COLORES.slice(0, freqEdad.length),
    borderRadius: 6, borderWidth: 0
  }]);

  // Histograma: frecuencia relativa (distribución porcentual)
  crearGrafico('chart-edad-hist', 'bar', freqEdad.map(f => f.etiqueta), [{
    label:           'Frecuencia relativa',
    data:            freqEdad.map(f => parseFloat(f.frecRel.toFixed(4))),
    backgroundColor: '#EF9F27',
    borderRadius: 0, borderWidth: 1, borderColor: '#854F0B'
  }]);

  // ── Gráficos de Procedencia ───────────────────────────
  // Circular: distribución porcentual de procedencias
  crearGrafico('chart-proc-pie', 'pie', freqProc.map(f => f.etiqueta), [{
    data:            freqProc.map(f => f.frecAbs),
    backgroundColor: COLORES.slice(0, freqProc.length),
    borderWidth: 0
  }]);

  // Barras: frecuencia absoluta por procedencia
  crearGrafico('chart-proc-bar', 'bar', freqProc.map(f => f.etiqueta), [{
    label:           'Visitantes',
    data:            freqProc.map(f => f.frecAbs),
    backgroundColor: COLORES.slice(0, freqProc.length),
    borderRadius: 6, borderWidth: 0
  }]);

  // ── Gráficos de Tipo de Visitante ─────────────────────
  // Barras: frecuencia absoluta por tipo de visitante
  crearGrafico('chart-tipo-bar', 'bar', freqTipo.map(f => f.etiqueta), [{
    label:           'Visitantes',
    data:            freqTipo.map(f => f.frecAbs),
    backgroundColor: COLORES.slice(0, freqTipo.length),
    borderRadius: 6, borderWidth: 0
  }]);

  // Dona: distribución porcentual por tipo de visitante
  crearGrafico('chart-tipo-pie', 'doughnut', freqTipo.map(f => f.etiqueta), [{
    data:            freqTipo.map(f => f.frecAbs),
    backgroundColor: COLORES.slice(0, freqTipo.length),
    borderWidth: 0
  }]);

  // Renderizar el cruce de variables inicial (el que esté seleccionado)
  renderCruce();
}

// ============================================================
// ARRANQUE AUTOMÁTICO
// Si ya hay una sesión activa (el admin no cerró el navegador),
// mostrar el dashboard directamente sin pedir contraseña.
// ============================================================
if (sessionStorage.getItem(CLAVE_SESION) === 'true') {
  mostrarDashboard();
}

// ============================================================
// EXPONER FUNCIONES AL HTML
// Con scripts normales (sin type="module"), las funciones
// definidas aquí son automáticamente globales. Este bloque
// las expone explícitamente al objeto window como buena
// práctica y para compatibilidad con los onclick del HTML.
// ============================================================
window.verificarLogin = verificarLogin;
window.cerrarSesion   = cerrarSesion;
window.mostrarTab     = mostrarTab;
window.renderCruce    = renderCruce;
window.exportarExcel  = exportarExcel;
window.limpiarDatos   = limpiarDatos;

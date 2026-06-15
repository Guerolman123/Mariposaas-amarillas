// ===== GOOGLE FORM URL =====
const GOOGLE_FORM_URL = 'https://forms.gle/EN3y3J8sN4eDUxw26';

// ===== ESTADO DEL FORMULARIO =====
const respuestas = { edad: null, procedencia: null, tipo: null };

// ===== MANEJO DE BOTONES DE OPCIÓN =====
document.querySelectorAll('.opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const campo = btn.dataset.field;
    const valor = btn.dataset.val;
    document.querySelectorAll(`.opt-btn[data-field="${campo}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    respuestas[campo] = valor;
    validarFormulario();
  });
});

// ===== VALIDAR CAMPOS =====
function validarFormulario() {
  const completo = respuestas.edad && respuestas.procedencia && respuestas.tipo;
  document.getElementById('btn-enviar').disabled = !completo;
}

// ===== ENVIAR — mostrar confirmación y abrir Google Form =====
function enviarFormulario() {
  document.getElementById('r-edad').textContent  = respuestas.edad;
  document.getElementById('r-proc').textContent  = respuestas.procedencia;
  document.getElementById('r-tipo').textContent  = respuestas.tipo;
  const ahora = new Date();
  document.getElementById('r-fecha').textContent =
    ahora.toLocaleDateString('es-CO') + ' · ' +
    ahora.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });

  // Poner el link real en el botón
  document.getElementById('btn-google-form').href = GOOGLE_FORM_URL;

  document.getElementById('form-section').classList.add('hidden');
  document.getElementById('confirmacion').classList.remove('hidden');
}

window.enviarFormulario = enviarFormulario;

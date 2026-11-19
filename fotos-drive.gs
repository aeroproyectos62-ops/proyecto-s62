// Script de Google Apps Script: guarda en Google Drive las fotos que cargan los alumnos
// y se las devuelve a la app para armar la carpeta en PDF. También avisa por mail al
// docente cuando un alumno pide acceso, y guarda en una planilla los datos que deja la
// gente en el formulario de sponsors de la página de la exposición (expo/) y cuenta
// las visitas a esa página.
// Se publica como "Aplicación web" (ejecutar como: yo; acceso: cualquier usuario) y su URL
// se pega en config.js como fotosScript. Solo acepta pedidos de miembros del proyecto:
// cada pedido trae el token de inicio de sesión de Firebase y se verifica acá.

const FIREBASE_API_KEY = 'AIzaSyC70wSXia1kIa5681aew3cTP3veqm5e-lU';      // apiKey de firebaseConfig
const FIREBASE_PROJECT = 'proyectos62-65acd';   // projectId de firebaseConfig
// Docentes principales: mantener igual a docentes en config.js y firestore.rules
// (los que se agregan desde la app no hace falta cargarlos acá)
const DOCENTES = ['agustinsekul@impatrq.com', 'aero.proyecto.s62@gmail.com'];
const CARPETA = 'Proyecto S62 - Fotos';

function doPost(e) {
  try {
    const d = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (d.accion === 'sponsor') return sponsor_(d);   // formulario público de la exposición, sin inicio de sesión
    if (d.accion === 'visita') return visita_(d);     // contador de visitas de la página de la exposición
    if (d.accion === 'aviso') return aviso_(d, cuenta_(d.idToken));
    const user = verificar_(d.idToken);
    if (d.accion === 'subir') return subir_(d, user);
    if (d.accion === 'foto') return foto_(d);
    return json_({ok: false, error: 'accion desconocida'});
  } catch (err) {
    return json_({ok: false, error: String(err.message || err)});
  }
}

// Comprueba el token con Firebase y devuelve la cuenta de Google que inició sesión
function cuenta_(idToken) {
  if (!idToken) throw new Error('sin sesion');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({idToken: idToken}), muteHttpExceptions: true
  });
  const u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u) throw new Error('sesion vencida');
  return u;
}

// Además exige que la cuenta sea docente o alumno aprobado
function verificar_(idToken) {
  const u = cuenta_(idToken);
  const email = String(u.email || '').toLowerCase();
  if (u.emailVerified && DOCENTES.map(x => x.toLowerCase()).indexOf(email) >= 0) return {uid: u.localId, email: email};
  // Docentes agregados desde la app
  const base = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/databases/(default)/documents/';
  if (u.emailVerified) {
    const dd = UrlFetchApp.fetch(base + 'docentes/' + encodeURIComponent(email), {headers: {Authorization: 'Bearer ' + idToken}, muteHttpExceptions: true});
    if (dd.getResponseCode() === 200) return {uid: u.localId, email: email};
  }
  const f = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT +
    '/databases/(default)/documents/usuarios/' + u.localId, {headers: {Authorization: 'Bearer ' + idToken}, muteHttpExceptions: true});
  const doc = JSON.parse(f.getContentText());
  const estado = doc.fields && doc.fields.estado && doc.fields.estado.stringValue;
  if (estado !== 'aprobado') throw new Error('no es miembro del proyecto');
  return {uid: u.localId, email: email};
}

function raiz_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (_) {} }
  const f = DriveApp.createFolder(CARPETA);
  props.setProperty('CARPETA_ID', f.getId());
  return f;
}

function subcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

// Guarda una foto en Proyecto S62 - Fotos/<sistema>/ y la deja visible con el enlace
function subir_(d, user) {
  const sistema = String(d.sistema || 'Otro').replace(/[\\/]/g, '-').slice(0, 60);
  const nombre = String(d.nombre || 'foto.jpg').replace(/[\\/]/g, '-').slice(0, 150);
  const blob = Utilities.newBlob(Utilities.base64Decode(d.data), 'image/jpeg', nombre);
  if (blob.getBytes().length > 8 * 1024 * 1024) throw new Error('foto demasiado grande');
  const file = subcarpeta_(raiz_(), sistema).createFile(blob);
  file.setDescription('Registro ' + String(d.registroId || '') + ' · cargó ' + user.email);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return json_({ok: true, id: file.getId()});
}

// Devuelve una foto en base64 para armar el PDF y el ZIP (solo fotos de la carpeta del proyecto)
function foto_(d) {
  const file = DriveApp.getFileById(String(d.id || ''));
  const raizId = raiz_().getId();
  let dentro = false;
  const padres = file.getParents();
  while (padres.hasNext()) {
    const p = padres.next();
    if (p.getId() === raizId) dentro = true;
    const abuelos = p.getParents();
    while (abuelos.hasNext()) if (abuelos.next().getId() === raizId) dentro = true;
  }
  if (!dentro) throw new Error('foto fuera del proyecto');
  return json_({ok: true, data: Utilities.base64Encode(file.getBlob().getBytes())});
}

// Mail al docente cuando un alumno pide acceso
function aviso_(d, u) {
  const nombre = String(d.nombre || '').slice(0, 120);
  const email = String(u.email || '').slice(0, 200);
  MailApp.sendEmail({
    to: DOCENTES.join(','),
    subject: 'Proyecto S62: ' + nombre + ' pide acceso',
    body: nombre + ' (' + email + ', ' + String(d.curso || '').slice(0, 60) + ') pidió acceso al Proyecto S62.\n\n' +
          'Para aceptarlo entrá como docente en:\n' + String(d.app || '') + '\n'
  });
  return json_({ok: true});
}

// Formulario de sponsors (expo/index.html): agrega una fila en la planilla
// "Proyecto S62 - Sponsors" (se crea sola la primera vez) y avisa por mail a los docentes.
const PLANILLA_SPONSORS = 'Proyecto S62 - Sponsors';
const CAMPOS_SPONSOR = ['nombre', 'empresa', 'rubro', 'telefono', 'email', 'localidad', 'ayuda', 'detalle', 'publicar'];

function sponsor_(d) {
  if (d.web) return json_({ok: true});   // campo trampa para robots: se ignora sin avisar
  const v = {};
  CAMPOS_SPONSOR.forEach(k => { v[k] = String(d[k] || '').replace(/^[=+\-@]/, "'$&").slice(0, k === 'detalle' ? 1500 : 200).trim(); });
  if (!v.nombre) throw new Error('falta el nombre');
  if (!v.telefono && !v.email) throw new Error('falta un contacto');
  // Límite simple contra envíos repetidos: hasta 60 por hora en total
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('sponsors_hora') || 0);
  if (n >= 60) throw new Error('demasiados envíos, probar más tarde');
  cache.put('sponsors_hora', String(n + 1), 3600);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);   // evita crear dos planillas si llegan dos envíos juntos
  try {
    planillaSponsors_().appendRow([new Date()].concat(CAMPOS_SPONSOR.map(k => v[k])).concat(['Nuevo']));
  } finally { lock.releaseLock(); }
  try {
    MailApp.sendEmail({
      to: DOCENTES.join(','),
      subject: 'Proyecto S62: nuevo sponsor, ' + v.nombre + (v.empresa ? ' (' + v.empresa + ')' : ''),
      body: CAMPOS_SPONSOR.filter(k => v[k]).map(k => k + ': ' + v[k]).join('\n') +
            '\n\nPlanilla: ' + SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPONSORS_ID')).getUrl()
    });
  } catch (_) {}   // si se terminó la cuota de mails del día, la fila igual queda guardada
  return json_({ok: true});
}

// Contador de visitas de expo/: la página manda nuevo=true la primera vez que se abre en
// cada celular o computadora. Devuelve el total.
function visita_(d) {
  const props = PropertiesService.getScriptProperties();
  if (!d.nuevo) return json_({ok: true, visitas: Number(props.getProperty('VISITAS') || 0)});
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const n = Number(props.getProperty('VISITAS') || 0) + 1;
    props.setProperty('VISITAS', String(n));
    return json_({ok: true, visitas: n});
  } finally { lock.releaseLock(); }
}

function planillaSponsors_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPONSORS_ID');
  if (id) { try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (_) {} }
  const ss = SpreadsheetApp.create(PLANILLA_SPONSORS);
  const hoja = ss.getSheets()[0];
  hoja.setName('Sponsors');
  hoja.appendRow(['Fecha', 'Nombre', 'Empresa', 'Rubro', 'Teléfono', 'Correo', 'Localidad', 'Con qué ayuda', 'Detalle', 'Mostrar nombre', 'Estado']);
  hoja.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#2E353B').setFontColor('#F2C230');
  hoja.setFrozenRows(1);
  props.setProperty('SPONSORS_ID', ss.getId());
  // La planilla queda en Mi unidad de la cuenta del proyecto
  return hoja;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

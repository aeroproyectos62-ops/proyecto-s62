// Script de Google Apps Script: guarda en Google Drive las fotos que cargan los alumnos
// y se las devuelve a la app para armar la carpeta en PDF. También avisa por mail al
// docente cuando un alumno pide acceso.
// Se publica como "Aplicación web" (ejecutar como: yo; acceso: cualquier usuario) y su URL
// se pega en config.js como fotosScript. Solo acepta pedidos de miembros del proyecto:
// cada pedido trae el token de inicio de sesión de Firebase y se verifica acá.

const FIREBASE_API_KEY = 'PEGAR_API_KEY';      // apiKey de firebaseConfig
const FIREBASE_PROJECT = 'PEGAR_PROJECT_ID';   // projectId de firebaseConfig
// Mantener igual a docentes en config.js y firestore.rules
const DOCENTES = ['agustinsekul@impatrq.com', 'aero.proyecto.s62@gmail.com'];
const CARPETA = 'Proyecto S62 - Fotos';

function doPost(e) {
  try {
    const d = JSON.parse((e.postData && e.postData.contents) || '{}');
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

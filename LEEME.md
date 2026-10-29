# Proyecto S62

Carpeta de campo digital de la restauración del Sikorsky S-62A **ZS-HCW** (EET N°7 Taller Regional Quilmes).
Los alumnos del proyecto cargan día a día las tareas y observaciones con fotos, siguen el cronograma de
marzo a noviembre de 2027 y al final se descarga todo junto: PDF de la carpeta, fotos y planilla.

- **Alumno**: entra con su cuenta de Google. La primera vez pide acceso y el docente lo acepta. Después carga registros, marca pasos de las tareas y ve todo lo cargado.
- **Docente**: entra con Google (cuentas listadas en `config.js` y `firestore.rules`). Acepta alumnos, marca registros como revisados y descarga la carpeta.
- **Sin señal**: los registros quedan guardados en el celular y se suben solos cuando vuelve la conexión. Las fotos esperan en una cola local.

Todo es gratis y **no pide tarjeta**: la página está en GitHub Pages, el login y los datos en Firebase (plan Spark, el gratuito) y las fotos en el Google Drive de la cuenta del proyecto.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa |
| `config.js` | Configuración de Firebase, mails de los docentes y URL del script de fotos |
| `firestore.rules` | Reglas de seguridad de la base de datos (se pegan en la consola de Firebase) |
| `fotos-drive.gs` | Script de Google Apps Script que guarda las fotos en Drive y avisa por mail los pedidos de acceso |
| `sw.js`, `manifest.json`, `icon*` | Para que la app se instale en el celular y abra sin señal |

## Puesta en marcha (todo desde la cuenta de Gmail del proyecto)

1. **Firebase** (console.firebase.google.com): crear un proyecto nuevo, sin Google Analytics. Queda en el plan Spark, que es gratis y no pide tarjeta.
   - *Compilación > Authentication > Comenzar*: activar el proveedor **Google**.
   - *Authentication > Configuración > Dominios autorizados*: agregar `USUARIO.github.io` (el dominio donde queda publicada la página).
   - *Compilación > Firestore Database > Crear base de datos*: ubicación `southamerica-east1` (São Paulo), modo producción.
   - *Firestore > Reglas*: pegar `firestore.rules` y publicar.
   - *Configuración del proyecto > Tus apps > Web (</>)*: registrar la app y copiar el bloque `firebaseConfig` en `config.js`.
   - No hace falta activar Storage: las fotos van a Drive.
2. **Docentes**: poner los mails en `config.js` (`docentes`), en `firestore.rules` (`isDocente`) y en `fotos-drive.gs` (`DOCENTES`). Las tres listas tienen que ser iguales.
3. **Script de fotos** (script.google.com, con la cuenta del proyecto): proyecto nuevo, pegar `fotos-drive.gs` y completar `FIREBASE_API_KEY` y `FIREBASE_PROJECT` con los datos de `firebaseConfig`.
   - *Implementar > Nueva implementación > Aplicación web*: ejecutar como **Yo**, acceso **Cualquier usuario**. Autorizar los permisos que pide (Drive, mail y conexión externa).
   - Copiar la URL que termina en `/exec` en `fotosScript` de `config.js`.
   - La primera foto crea en Drive la carpeta **Proyecto S62 - Fotos**, con una subcarpeta por sistema.
   - Si después se cambia el script, hay que hacer *Implementar > Gestionar implementaciones > Editar > Versión nueva* para que la URL siga siendo la misma.
4. **GitHub**: *Settings > Pages > Deploy from a branch > `main` / root*.
5. Entrar como docente, y pasarles el link a los alumnos para que pidan acceso. En *Alumnos* se aceptan.

## Datos

- `usuarios/{uid}`: pedidos de acceso de los alumnos (`pendiente`, `aprobado` o `rechazado`).
- `registros/{id}`: cada registro, con sus fotos como identificadores de archivos de Drive.
- `tareas/{A..AB}`: estado, pasos tildados y grupo a cargo de cada tarea del cronograma.

Las fotos quedan en Drive con permiso "cualquiera con el enlace puede ver", así la app las muestra sin pedir otro inicio de sesión. El enlace no se puede adivinar, pero quien lo tenga puede ver esa foto.

El cronograma (semanas, tareas A a AB, holguras y colores de etapa) es el del documento
*S-62 ZS-HCW: proyecto de pintura*, sección 07 y 08. Si cambia el plan, se edita en `WEEKS` y `TASKS` dentro de `index.html`.

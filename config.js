// Configuración de la app. Completar con los datos del proyecto de Firebase y del script de fotos.
window.APP_CONFIG = {
  // Pegar acá el bloque firebaseConfig de la consola de Firebase (no es secreto).
  firebase: {
    apiKey: "AIzaSyC70wSXia1kIa5681aew3cTP3veqm5e-lU",
    authDomain: "proyectos62-65acd.firebaseapp.com",
    projectId: "proyectos62-65acd",
    storageBucket: "proyectos62-65acd.firebasestorage.app",
    messagingSenderId: "330801845828",
    appId: "1:330801845828:web:3dcd0d91a1e7fbdeea8e11"
  },
  // Cuentas de Google de los docentes (deben coincidir con firestore.rules y con DOCENTES en fotos-drive.gs).
  docentes: ["agustinsekul@impatrq.com", "aero.proyecto.s62@gmail.com"],
  // URL del script de Google que guarda las fotos en Drive (ver fotos-drive.gs).
  fotosScript: ""
};

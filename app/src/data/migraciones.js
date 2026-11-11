// Migraciones de los datos locales, por colección. MIGRATIONS[nombre][i] lleva los datos de la
// versión i+1 a la i+2. Nunca se edita una migración publicada: se añade otra al final, con su
// prueba en test/storage.test.mjs.
//
// Ejemplo (cuando haga falta):
//   pacientes: [
//     d => Object.fromEntries(Object.entries(d).map(([id, p]) => [id, { ...p, archivado: false }])),
//   ],
export const MIGRATIONS = Object.freeze({});

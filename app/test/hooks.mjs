// Resuelve el alias @shared de Vite para las pruebas con node --test.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@shared/')) return next(new URL(`../../server/public/${specifier.slice(8)}`, import.meta.url).href, context);
  return next(specifier, context);
}

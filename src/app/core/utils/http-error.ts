import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrae un mensaje legible de un error HTTP.
 * - Texto plano del backend → se devuelve tal cual.
 * - Mapa { campo: mensaje } (validaciones @Valid) → se unen los mensajes.
 * - Sin conexión (status 0) → mensaje de red.
 */
export function extractError(err: unknown, fallback = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  const e = err as HttpErrorResponse;
  const body = e?.error;

  if (typeof body === 'string' && body.trim()) return body;

  if (body && typeof body === 'object') {
    const msgs = Object.values(body).filter((v): v is string => typeof v === 'string' && !!v);
    if (msgs.length) return msgs.join(' · ');
  }

  if (e?.status === 0) return 'No se pudo conectar con el servidor.';
  if (e?.status === 401 || e?.status === 403) return 'No tienes permiso para esta acción.';
  return fallback;
}

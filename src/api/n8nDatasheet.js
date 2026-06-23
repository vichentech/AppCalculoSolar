/**
 * VichenSolarApp — N8N Datasheet API
 * Módulo para comunicarse con el servicio N8N de extracción de fichas técnicas.
 *
 * Endpoints de N8N:
 *   POST /webhook/datasheet/extract-models  → detecta modelos en el PDF
 *   POST /webhook/datasheet/extract-specs   → extrae specs de un modelo concreto
 */

// URL base del servicio N8N.
// En desarrollo usa el proxy de Vite (/n8n → localhost:5678).
// En producción usa la variable de entorno VITE_N8N_BASE_URL.
const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL
  ? `${import.meta.env.VITE_N8N_BASE_URL}/webhook`
  : '/n8n/webhook';   // proxy Vite en desarrollo

/**
 * Envía el PDF a N8N y obtiene la lista de modelos detectados por IA.
 *
 * @param {File} pdfFile - El objeto File del PDF subido por el usuario
 * @param {string} [customUrl] - URL de webhook personalizada (opcional, sobreescribe la por defecto)
 * @returns {Promise<{ success: boolean, manufacturer: string, models: Array, rawText: string }>}
 */
export async function extractModels(pdfFile, customUrl = null) {
  const url = customUrl || `${N8N_BASE_URL}/datasheet/extract-models`;

  if (!pdfFile || pdfFile.type !== 'application/pdf') {
    throw new Error('El archivo debe ser un PDF válido.');
  }

  const formData = new FormData();
  formData.append('file', pdfFile, pdfFile.name);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    // No establecer Content-Type: el navegador lo hace con el boundary correcto
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`N8N devolvió HTTP ${response.status}: ${errText || response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'N8N no pudo procesar el PDF correctamente.');
  }

  return {
    success: true,
    manufacturer: data.manufacturer || 'Desconocido',
    models: Array.isArray(data.models) ? data.models : [],
    rawText: data.rawText || '',
  };
}

/**
 * Envía el nombre del modelo elegido y el texto del PDF a N8N para extraer
 * los parámetros técnicos completos con IA.
 *
 * @param {string} modelName - Nombre del modelo seleccionado por el usuario
 * @param {string} rawText   - Texto del PDF obtenido en el paso anterior
 * @param {string} [customUrl] - URL de webhook personalizada (opcional)
 * @returns {Promise<Object>} - Objeto con todos los parámetros técnicos del panel
 */
export async function extractSpecs(modelName, rawText, customUrl = null) {
  const url = customUrl || `${N8N_BASE_URL}/datasheet/extract-specs`;

  if (!modelName) {
    throw new Error('Debes indicar el nombre del modelo a extraer.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName, rawText }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`N8N devolvió HTTP ${response.status}: ${errText || response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'N8N no pudo extraer las especificaciones del modelo.');
  }

  return data;
}

/**
 * Devuelve la URL base de N8N configurada actualmente.
 * Útil para mostrarla en la UI de configuración.
 */
export function getN8nBaseUrl() {
  return import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678';
}

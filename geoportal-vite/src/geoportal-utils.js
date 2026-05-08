export function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getGeoServerErrorMessage(error) {
  return error?.message === 'TIMEOUT'
    ? 'A consulta demorou mais que o esperado. Tente novamente.'
    : 'Não foi possível consultar os dados no momento.';
}

export function buildEnderecoCqlFilter(rawQuery) {
  const parsed = parseEnderecoQuery(rawQuery);
  return buildRuaCandidatesCqlFilter(parsed);
}

export function parseEnderecoQuery(rawQuery) {
  const sanitized = rawQuery.replace(/\s+/g, ' ').trim();
  const numberMatches = sanitized.match(/\d+/g) || [];
  const targetNumber = numberMatches.length > 0
    ? parseInt(numberMatches[numberMatches.length - 1], 10)
    : null;

  const normalizedStreet = sanitized
    .replace(/[\.,;:\/\\\-'"()]+/g, ' ')
    .replace(/\b(?:n(?:[\u00BA\u00B0o])?|numero)\s*(?=\d)/gi, ' ')
    .replace(/^\s*(?:rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|rodovia|estrada)\s+/i, '')
    .replace(/\b(?:de|da|do|das|dos)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const streetTokens = [...new Set(
    normalizedStreet
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length > 2)
  )];

  return {
    streetTokens,
    streetText: streetTokens.join(' '),
    targetNumber,
    hasNumber: Number.isInteger(targetNumber)
  };
}

export function buildRuaCandidatesCqlFilter(parsed) {
  if (!parsed || !parsed.streetTokens || parsed.streetTokens.length === 0) {
    return '';
  }

  const streetText = (parsed.streetText || '').replace(/'/g, "''");
  const tokenFilter = parsed.streetTokens
    .map(token => `endereco ILIKE '%${token.replace(/'/g, "''")}%'`)
    .join(' AND ');

  if (!streetText) {
    return tokenFilter;
  }

  return `(endereco ILIKE '%${streetText}%' OR (${tokenFilter}))`;
}

export function extractNumeroFromEndereco(endereco) {
  if (!endereco) return null;

  const matches = String(endereco).match(/\d+/g);

  if (!matches || matches.length === 0) return null;

  const numero = Number.parseInt(matches[matches.length - 1], 10);
  return Number.isInteger(numero) ? numero : null;
}

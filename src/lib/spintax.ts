/**
 * Parse and resolve spintax text.
 * Supports nested {a|b|{c|d}} and [OPCIONAL] blocks.
 */
export function resolveSpintax(text: string): string {
  // Protect send variables {{name}} from being processed as spintax
  const placeholders: string[] = [];
  let result = text.replace(/\{\{([^}]+)\}\}/g, (_match, name) => {
    const idx = placeholders.length;
    placeholders.push(`{{${name}}}`);
    return `\x00VAR${idx}\x00`;
  });

  // Remove [OPCIONAL] blocks randomly (50% chance)
  result = result.replace(/\[OPCIONAL\]\s*([^\n]*)/gi, () => {
    return Math.random() > 0.5 ? '' : '';
  });

  // Handle optional blocks: {[OPCIONAL] content}
  result = result.replace(/\{(\[OPCIONAL\])\s*([^}]*)\}/gi, (_match, _tag, content) => {
    return Math.random() > 0.5 ? content.trim() : '';
  });

  // Resolve spintax from innermost out
  const MAX_ITER = 50;
  let i = 0;
  while (result.includes('{') && i < MAX_ITER) {
    result = result.replace(/\{([^{}]+)\}/g, (_match, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)].trim();
    });
    i++;
  }

  // Restore send variables
  result = result.replace(/\x00VAR(\d+)\x00/g, (_match, idx) => placeholders[parseInt(idx)]);

  // Clean up multiple spaces/newlines
  return result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
}

/**
 * Resolve spintax always picking the FIRST option (for preview/audio).
 */
export function resolveSpintaxFirst(text: string): string {
  const placeholders: string[] = [];
  let result = text.replace(/\{\{([^}]+)\}\}/g, (_match, name) => {
    const idx = placeholders.length;
    placeholders.push(`{{${name}}}`);
    return `\x00VAR${idx}\x00`;
  });

  result = result.replace(/\[OPCIONAL\]\s*([^\n]*)/gi, (_match, content) => content);
  result = result.replace(/\{(\[OPCIONAL\])\s*([^}]*)\}/gi, (_match, _tag, content) => content.trim());

  const MAX_ITER = 50;
  let i = 0;
  while (result.includes('{') && i < MAX_ITER) {
    result = result.replace(/\{([^{}]+)\}/g, (_match, group) => {
      const options = group.split('|');
      return options[0].trim();
    });
    i++;
  }

  result = result.replace(/\x00VAR(\d+)\x00/g, (_match, idx) => placeholders[parseInt(idx)]);
  return result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
}

/**
 * Reconstruct a spintax message using saved variation indices.
 * This mirrors the order used in broadcast-processor's resolveSpintaxWithIndices.
 */
export function resolveSpintaxByIndices(text: string, indices: number[]): string {
  let idx = 0;

  const placeholders: string[] = [];
  let result = text.replace(/\{\{([^}]+)\}\}/g, (_match, name) => {
    const i = placeholders.length;
    placeholders.push(`{{${name}}}`);
    return `\x00VAR${i}\x00`;
  });

  // [OPCIONAL] inline
  result = result.replace(/\[OPCIONAL\]\s*([^\n]*)/gi, (_match, content) => {
    const pick = indices[idx++] ?? 0;
    return pick === 0 ? content : '';
  });
  // {[OPCIONAL] content}
  result = result.replace(/\{(\[OPCIONAL\])\s*([^}]*)\}/gi, (_match, _tag, content) => {
    const pick = indices[idx++] ?? 0;
    return pick === 0 ? content.trim() : '';
  });

  const MAX_ITER = 50;
  let i = 0;
  while (result.includes('{') && i < MAX_ITER) {
    result = result.replace(/\{([^{}]+)\}/g, (_match, group) => {
      const options = group.split('|');
      const pick = indices[idx++] ?? 0;
      return options[Math.min(pick, options.length - 1)].trim();
    });
    i++;
  }

  result = result.replace(/\x00VAR(\d+)\x00/g, (_match, i) => placeholders[parseInt(i)]);
  return result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
}

/**
 * Count approximate number of unique combinations.
 */
export function countSpintaxCombinations(text: string): number {
  let count = 1;
  const regex = /\{([^{}]+)\}/g;
  let match;
  let processed = text;

  const MAX_ITER = 50;
  let iter = 0;
  while ((match = regex.exec(processed)) !== null && iter < MAX_ITER) {
    const options = match[1].split('|');
    count *= options.length;
    iter++;
  }

  // Optional blocks double the combinations
  const optionalCount = (processed.match(/\[OPCIONAL\]/gi) || []).length;
  count *= Math.pow(2, optionalCount);

  return count;
}

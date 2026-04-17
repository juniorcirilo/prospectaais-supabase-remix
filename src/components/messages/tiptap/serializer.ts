import type { JSONContent } from '@tiptap/core';

/**
 * Convert spintax string → TipTap HTML for setContent()
 */
export function spintaxToHTML(text: string): string {
  if (!text) return '<p></p>';

  let html = text;

  // Replace {{var}} with send variable spans (must come first)
  html = html.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    `<span data-send-variable data-name="${name}">{{${name}}}</span>`
  );

  // Replace {opt1|opt2} with variation spans (single-brace only)
  html = html.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (_, group) => {
    const options = group.split('|').map((o: string) => o.trim());
    const escaped = JSON.stringify(options).replace(/"/g, '&quot;');
    return `<span data-variation data-options="${escaped}">${options[0]}</span>`;
  });

  // Wrap lines in paragraphs
  html = html
    .split('\n')
    .map(line => `<p>${line || '<br>'}</p>`)
    .join('');

  return html;
}

/**
 * Convert TipTap JSON doc → spintax string
 */
export function docToSpintax(doc: JSONContent): string {
  const paragraphs: string[] = [];

  function walkInline(node: JSONContent): string {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'variation') {
      const opts = node.attrs?.options || [];
      return `{${opts.join('|')}}`;
    }
    if (node.type === 'sendVariable') {
      return `{{${node.attrs?.name || ''}}}`;
    }
    if (node.type === 'hardBreak') return '\n';
    if (node.content) return node.content.map(walkInline).join('');
    return '';
  }

  if (doc.content) {
    for (const node of doc.content) {
      if (node.type === 'paragraph') {
        const text = node.content ? node.content.map(walkInline).join('') : '';
        paragraphs.push(text);
      } else {
        paragraphs.push(walkInline(node));
      }
    }
  }

  return paragraphs.join('\n');
}

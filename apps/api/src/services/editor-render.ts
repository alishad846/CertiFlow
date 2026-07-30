import { renderTemplateString } from './template-placeholders';
import type { TemplateData } from './template-placeholders';

/**
 * Replace every `{{token}}` occurrence in a Canva editor document with its value from `context`,
 * returning a deep clone (the input is never mutated).
 *
 * Tokens only ever live inside text-layer HTML, so a format-agnostic recursive string walk is the
 * most robust merge: it works on both the readable design shape and the PACKED/minified shape that
 * is actually stored in `certificate_templates.editor_document` (where a text layer's HTML lives
 * under the short key `v`). This same merge is reused by the headless PDF renderer so the on-screen
 * design and the rendered certificate stay in lockstep.
 *
 * Unresolved tokens collapse to an empty string (renderTemplateString's behaviour), which is what we
 * want for a final render — a missing column should not leak `{{placeholder}}` onto the certificate.
 */
export function mergeEditorDocument<T>(design: T, context: TemplateData): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return renderTemplateString(node, context);
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(value);
      }
      return out;
    }
    return node;
  };

  return walk(design) as T;
}

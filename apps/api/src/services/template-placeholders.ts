export type TemplateData = Record<string, unknown>;

export type TemplateValue = string | number | boolean | bigint | Date | null | undefined;

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const NORMALIZE_PATTERN = /[^a-z0-9]+/g;
const PLACEHOLDER_ALIASES: Record<string, string[]> = {
  name: ['name', 'full_name', 'recipient_name', 'candidate_name'],
  email: ['email', 'email_address', 'recipient_email'],
  role: ['role', 'designation', 'position', 'job_title', 'job_role'],
  course: ['course', 'program', 'program_name'],
  date: ['date', 'issue_date', 'joining_date', 'completion_date', 'today'],
  roll_no: ['roll_no', 'roll_number', 'rollnumber']
};

// Reverse index: an alias (e.g. `recipient_name`, `issue_date`) → its canonical key (`name`, `date`).
// The certificate editor exposes friendly placeholders like `{{recipient_name}}` and `{{issue_date}}`,
// but the runtime context is keyed by the canonical field (`name`, plus a worker-supplied `issue_date`).
// Without this, those placeholders resolve to undefined and render blank on the signed certificate.
const REVERSE_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(PLACEHOLDER_ALIASES)) {
    for (const alias of aliases) {
      if (alias !== canonical) {
        map[alias] = canonical;
      }
    }
  }
  return map;
})();

function normalizeLookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(NORMALIZE_PATTERN, '_')
    .replace(/^_+|_+$/g, '');
}

function getMatchingValue(data: TemplateData, key: string) {
  const directKey = key.trim();
  if (!directKey) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(data, directKey)) {
    return data[directKey];
  }

  const normalizedKey = normalizeLookupKey(directKey);
  if (!normalizedKey) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(data, normalizedKey)) {
    return data[normalizedKey];
  }

  for (const [entryKey, entryValue] of Object.entries(data)) {
    if (normalizeLookupKey(entryKey) === normalizedKey) {
      return entryValue;
    }
  }

  const aliases = PLACEHOLDER_ALIASES[normalizedKey];
  if (aliases?.length) {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(data, alias)) {
        return data[alias];
      }
      for (const [entryKey, entryValue] of Object.entries(data)) {
        if (normalizeLookupKey(entryKey) === alias) {
          return entryValue;
        }
      }
    }
  }

  // The placeholder itself may be an alias (e.g. `recipient_name`, `issue_date`). Fall back to the
  // canonical field and its whole alias family so editor placeholders resolve against the CSV context.
  const canonical = REVERSE_ALIASES[normalizedKey];
  if (canonical) {
    const canonicalFamily = [canonical, ...(PLACEHOLDER_ALIASES[canonical] ?? [])];
    for (const candidate of canonicalFamily) {
      if (Object.prototype.hasOwnProperty.call(data, candidate)) {
        return data[candidate];
      }
      for (const [entryKey, entryValue] of Object.entries(data)) {
        if (normalizeLookupKey(entryKey) === candidate) {
          return entryValue;
        }
      }
    }
  }

  return undefined;
}

function resolvePath(data: TemplateData, key: string): unknown {
  const directMatch = getMatchingValue(data, key);
  if (directMatch !== undefined) {
    return directMatch;
  }

  if (!key.includes('.')) {
    return directMatch;
  }

  return key.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    const record = current as Record<string, unknown>;
    const nestedMatch = getMatchingValue(record, segment);
    return nestedMatch !== undefined ? nestedMatch : undefined;
  }, data);
}

export function normalizePlaceholderKey(value: string) {
  return value.trim();
}

export function formatTemplateValue(value: TemplateValue) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }

  return String(value);
}

export function renderTemplateString(input: string, data: TemplateData) {
  if (!input || !input.includes('{{')) {
    return input;
  }

  return input.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const normalizedKey = normalizePlaceholderKey(key);
    const resolved = resolvePath(data, normalizedKey);

    if (resolved === undefined) {
      return '';
    }

    return formatTemplateValue(resolved as TemplateValue);
  });
}

export function extractTemplatePlaceholders(input: string) {
  if (!input) {
    return [];
  }

  const placeholders = new Set<string>();
  for (const match of input.matchAll(PLACEHOLDER_PATTERN)) {
    const normalizedKey = normalizePlaceholderKey(match[1] ?? '');
    if (normalizedKey) {
      placeholders.add(normalizedKey);
    }
  }

  return Array.from(placeholders);
}

export function hasTemplatePlaceholders(input: string) {
  return !!input && /\{\{\s*[A-Za-z0-9_.-]+\s*\}\}/.test(input);
}

export function replaceTemplatePlaceholders(input: string, data: TemplateData) {
  return renderTemplateString(input, data);
}

const templatePlaceholderHelpers = {
  extractTemplatePlaceholders,
  formatTemplateValue,
  hasTemplatePlaceholders,
  normalizePlaceholderKey,
  renderTemplateString,
  replaceTemplatePlaceholders
} as const;

export default templatePlaceholderHelpers;

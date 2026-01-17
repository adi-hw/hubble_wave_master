import { BadRequestException } from '@nestjs/common';

type YamlNode = Record<string, unknown> | unknown[];

function parseYamlValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'null') {
    return null;
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}

function ensureObject(target: YamlNode, context: string): Record<string, unknown> {
  if (Array.isArray(target)) {
    throw new BadRequestException(`YAML parse error: ${context} expects an object`);
  }
  return target;
}

function ensureArray(target: YamlNode, context: string): unknown[] {
  if (!Array.isArray(target)) {
    throw new BadRequestException(`YAML parse error: ${context} expects an array`);
  }
  return target;
}

export function parseYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.split('\n');
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: YamlNode }> = [{ indent: -1, obj: root }];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmedLine = rawLine.trimEnd();
    if (!trimmedLine || trimmedLine.trimStart().startsWith('#')) {
      continue;
    }

    const indent = rawLine.search(/\S/);
    if (indent < 0) {
      continue;
    }

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;
    const line = trimmedLine.trim();

    if (line.startsWith('-')) {
      const list = ensureArray(current, `line ${index + 1}`);
      const content = line.slice(1).trim();

      if (!content) {
        const nextLine = lines[index + 1] || '';
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed.startsWith('-')) {
          const newArray: unknown[] = [];
          list.push(newArray);
          stack.push({ indent, obj: newArray });
        } else {
          const newObject: Record<string, unknown> = {};
          list.push(newObject);
          stack.push({ indent, obj: newObject });
        }
        continue;
      }

      const inlineColon = content.indexOf(':');
      if (inlineColon > -1) {
        const key = content.slice(0, inlineColon).trim();
        const value = content.slice(inlineColon + 1).trim();
        const newObject: Record<string, unknown> = {
          [key]: value ? parseYamlValue(value) : {},
        };
        list.push(newObject);
        stack.push({ indent, obj: newObject });
        continue;
      }

      list.push(parseYamlValue(content));
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new BadRequestException(`YAML parse error: missing ":" on line ${index + 1}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    const obj = ensureObject(current, `line ${index + 1}`);

    if (!value) {
      const nextLine = lines[index + 1] || '';
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed.startsWith('-')) {
        const newArray: unknown[] = [];
        obj[key] = newArray;
        stack.push({ indent, obj: newArray });
      } else {
        const newObject: Record<string, unknown> = {};
        obj[key] = newObject;
        stack.push({ indent, obj: newObject });
      }
      continue;
    }

    obj[key] = parseYamlValue(value);
  }

  return root;
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  const text = String(value);
  const needsQuotes =
    /[:#\n]/.test(text) ||
    text.trim() !== text ||
    /^-?\d+(\.\d+)?$/.test(text);
  if (needsQuotes) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

export function toYaml(data: Record<string, unknown>, indent = 0): string {
  const lines: string[] = [];
  const pad = '  '.repeat(indent);

  for (const key of Object.keys(data)) {
    const value = data[key];
    if (Array.isArray(value)) {
      lines.push(`${pad}${key}:`);
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          lines.push(`${pad}  -`);
          lines.push(toYaml(item as Record<string, unknown>, indent + 2));
        } else {
          lines.push(`${pad}  - ${formatScalar(item)}`);
        }
      }
      continue;
    }
    if (value && typeof value === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value as Record<string, unknown>, indent + 1));
      continue;
    }
    lines.push(`${pad}${key}: ${formatScalar(value)}`);
  }

  return lines.join('\n');
}

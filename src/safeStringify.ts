import { DumpOptions, safeDump } from 'js-yaml';

export const safeStringify = (value: any, options?: DumpOptions): string => {
  if (!value || typeof value === 'string') return value;

  return safeDump(value, options);
};

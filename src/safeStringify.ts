import { DumpOptions } from 'js-yaml';
import { safeDump } from 'yaml-ast-parser';

export const safeStringify = (value: any, options?: DumpOptions): string => {
  if (!value || typeof value === 'string') return value;

  return safeDump(value, options);
};

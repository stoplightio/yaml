import { DumpOptions, safeDump } from '@stoplight/yaml-ast-parser';

export const safeStringify = (value: unknown, options?: DumpOptions): string =>
  typeof value === 'string' ? value : safeDump(value, options);

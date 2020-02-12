import { DumpOptions, safeDump } from '@stoplight/yaml-ast-parser';

export const safeStringify = (value: any, options?: DumpOptions): string => {
  return safeDump(value, options);
};

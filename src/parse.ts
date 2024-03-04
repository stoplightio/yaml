import { parseWithPointers } from './parseWithPointers';

export const parse = <T>(value: string): T => parseWithPointers(value).data as T;

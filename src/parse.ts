import { load as loadAST } from '@stoplight/yaml-ast-parser';
import { walkAST } from './parseWithPointers';
import { YAMLNode } from './types';

export const parse = <T>(value: string): T => walkAST(loadAST(value) as YAMLNode) as T;

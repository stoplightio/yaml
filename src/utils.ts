import { YAMLNode } from 'yaml-ast-parser';

export const isValidNode = (node: YAMLNode) => node !== null && node !== undefined;

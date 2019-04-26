import { IParserResult } from '@stoplight/types';
import { YAMLNode } from 'yaml-ast-parser';

export type YamlParserResult<T> = IParserResult<T, YAMLNode, number[]>;

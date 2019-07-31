import { IParserResult } from '@stoplight/types';
import { LoadOptions, YAMLNode } from 'yaml-ast-parser';

export interface IParseOptions extends LoadOptions {
  json?: boolean; // if true, properties can be overridden, otherwise throws
  mergeKeys?: boolean;
}

export type YamlParserResult<T> = IParserResult<T, YAMLNode, number[], IParseOptions>;

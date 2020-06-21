import { IParserResult, Optional } from '@stoplight/types';
import * as YAMLAstParser from '@stoplight/yaml-ast-parser';
import { Kind, ScalarType } from '@stoplight/yaml-ast-parser';

export interface IParseOptions extends YAMLAstParser.LoadOptions {
  json?: boolean; // if true, properties can be overridden, otherwise throws
  bigInt?: boolean;
  mergeKeys?: boolean;
  preserveKeyOrder?: boolean;
}

export type YAMLBaseNode<K extends Kind> = Omit<YAMLAstParser.YAMLNode, 'kind' | 'parent'> & {
  kind: K;
  parent: YAMLNode;
};
export type YAMLAnchorReference = Omit<YAMLAstParser.YAMLAnchorReference, 'kind' | 'value' | 'parent'> & {
  kind: Kind.ANCHOR_REF;
  value: Optional<YAMLNode>;
  parent: YAMLNode;
};
export type YAMLIncludeReference = YAMLBaseNode<Kind.INCLUDE_REF>;
export type YAMLScalar = Omit<YAMLAstParser.YAMLScalar, 'kind' | 'parent'> & {
  kind: Kind.SCALAR;
  parent: YAMLNode;
  valueObject: unknown;
};
export type YAMLMap = Omit<YAMLAstParser.YamlMap, 'kind' | 'mappings' | 'parent'> & {
  kind: Kind.MAP;
  mappings: YAMLMapping[];
  parent: YAMLNode;
};
export type YAMLMapping = Omit<YAMLAstParser.YAMLMapping, 'kind' | 'key' | 'value' | 'parent'> & {
  kind: Kind.MAPPING;
  key: YAMLScalar;
  value: YAMLNode | null;
  parent: YAMLNode;
};
export type YAMLSequence = Omit<YAMLAstParser.YAMLSequence, 'kind' | 'items' | 'parent'> & {
  kind: Kind.SEQ;
  items: Array<YAMLNode | null>;
  parent: YAMLNode;
};

export type YAMLNode = YAMLAnchorReference | YAMLIncludeReference | YAMLScalar | YAMLMap | YAMLMapping | YAMLSequence;

export type YamlParserResult<T> = IParserResult<T, YAMLNode, number[], IParseOptions>;

export { Kind, ScalarType };

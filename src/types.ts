import { IParserResult, Optional } from '@stoplight/types';
import * as YAMLAstParser from '@stoplight/yaml-ast-parser';
import { Kind, ScalarType } from '@stoplight/yaml-ast-parser';

export interface IParseOptions extends YAMLAstParser.LoadOptions {
  json?: boolean; // if true, properties can be overridden, otherwise throws
  mergeKeys?: boolean;
}

export type YAMLAnchorReference = Omit<YAMLAstParser.YAMLAnchorReference, 'kind' | 'value' | 'parent'> & {
  kind: Kind.ANCHOR_REF;
  value: Optional<YAMLNode>;
  parent: YAMLNode;
};
export type YAMLIncludeReference = Omit<YAMLAstParser.YAMLNode, 'kind' | 'parent'> & {
  kind: Kind.INCLUDE_REF;
  parent: YAMLNode;
};
export type YAMLScalar = Omit<YAMLAstParser.YAMLScalar, 'kind' | 'parent'> & { kind: Kind.SCALAR; parent: YAMLNode };
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
  items: YAMLNode[];
  parent: YAMLNode;
};

export type YAMLNode = YAMLAnchorReference | YAMLIncludeReference | YAMLScalar | YAMLMap | YAMLMapping | YAMLSequence;

export type YAMLIgnoreKeys =
  | 'anchorId'
  | 'errors'
  | 'referencesAnchor'
  | 'doubleQuoted'
  | 'singleQuoted'
  | 'plainScalar'
  | 'rawValue';

export type YAMLCompactAnchorReference = Omit<YAMLAnchorReference, YAMLIgnoreKeys | 'value' | 'parent'> & {
  value: Optional<YAMLCompactNode>;
  parent: YAMLCompactNode;
};
export type YAMLCompactIncludeReference = Omit<YAMLIncludeReference, YAMLIgnoreKeys | 'parent'> & {
  parent: YAMLCompactNode;
};
export type YAMLCompactScalar = Omit<YAMLScalar, YAMLIgnoreKeys | 'parent'> & { parent: YAMLCompactNode };
export type YAMLCompactMap = Omit<YAMLMap, YAMLIgnoreKeys | 'mappings' | 'parent'> & {
  mappings: YAMLCompactMapping[];
  parent: YAMLCompactNode;
};
export type YAMLCompactMapping = Omit<YAMLMapping, YAMLIgnoreKeys | 'key' | 'value' | 'parent'> & {
  key: YAMLCompactScalar;
  value: YAMLCompactNode | null;
  parent: YAMLCompactNode;
};
export type YAMLCompactSequence = Omit<YAMLSequence, YAMLIgnoreKeys | 'items' | 'parent'> & {
  items: YAMLCompactNode[];
  parent: YAMLCompactNode;
};

export type YAMLCompactNode =
  | YAMLCompactIncludeReference
  | YAMLCompactScalar
  | YAMLCompactAnchorReference
  | YAMLCompactMap
  | YAMLCompactMapping
  | YAMLCompactSequence;

export type YamlParserResult<T> = IParserResult<T, YAMLNode, number[], IParseOptions>;
export type YamlParserCompactResult<T> = IParserResult<T, YAMLCompactNode, number[], IParseOptions>;

export type YAMLASTNode = YAMLNode | YAMLCompactNode;

export { Kind, ScalarType };

import { IParserResult, Optional } from '@stoplight/types';
import * as YAMLAstParser from '@stoplight/yaml-ast-parser';
import { Kind, ScalarType } from '@stoplight/yaml-ast-parser';

export interface IParseOptions extends YAMLAstParser.LoadOptions {
  json?: boolean; // if true, properties can be overridden, otherwise throws
  mergeKeys?: boolean;
  compact?: boolean; // true by default
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
  items: Array<null | YAMLNode>;
  parent: YAMLNode;
};

export type YAMLNode = YAMLAnchorReference | YAMLIncludeReference | YAMLScalar | YAMLMap | YAMLMapping | YAMLSequence;

export type YAMLIgnoreKeys = 'errors';
export type YAMLAnchorIgnoreKeys = 'anchorId' | 'referencesAnchor';
export type YAMLScalarIgnoreKeys = 'doubleQuoted' | 'singleQuoted' | 'plainScalar' | 'rawValue';

export type YAMLCompactAnchorReference = Omit<
  YAMLAnchorReference,
  YAMLIgnoreKeys | YAMLAnchorIgnoreKeys | 'value' | 'parent'
> & {
  value: Optional<YAMLCompactNode>;
  parent: YAMLCompactNode;
};
export type YAMLCompactIncludeReference = Omit<YAMLIncludeReference, YAMLIgnoreKeys | 'parent'> & {
  parent: YAMLCompactNode;
};
export type YAMLCompactScalar = Omit<YAMLScalar, YAMLScalarIgnoreKeys | 'parent'> & { parent: YAMLCompactNode };
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

export type YamlParserResult<T> = IParserResult<T, YAMLASTNode, number[], IParseOptions>;

export type YAMLASTAnchorReference = YAMLAnchorReference | YAMLCompactAnchorReference;
export type YAMLASTIncludeReference = YAMLIncludeReference | YAMLCompactIncludeReference;
export type YAMLASTScalar = YAMLScalar | YAMLCompactScalar;
export type YAMLASTMap = YAMLMap | YAMLCompactMap;
export type YAMLASTMapping = YAMLMapping | YAMLCompactMapping;
export type YAMLASTSequence = YAMLSequence | YAMLCompactSequence;

export type YAMLASTNode = YAMLNode | YAMLCompactNode;

export { Kind, ScalarType };

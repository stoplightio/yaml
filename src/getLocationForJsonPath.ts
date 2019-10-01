import { GetLocationForJsonPath, ILocation, JsonPath, Optional } from '@stoplight/types';
import { Kind } from '@stoplight/yaml-ast-parser';
import { SpecialMappingKeys } from './consts';
import { lineForPosition } from './lineForPosition';
import {
  Kind,
  YAMLCompactMapping,
  YAMLCompactNode,
  YAMLMapping,
  YAMLNode,
  YamlParserCompactResult,
  YamlParserResult,
  YAMLSequence,
} from './types';
import { isObject } from './utils';

export const getLocationForJsonPath: GetLocationForJsonPath<
  YamlParserResult<unknown> | YamlParserCompactResult<unknown>
> = ({ ast, lineMap, metadata }, path, closest = false) => {
  const node = findNodeAtPath(ast, path, { closest, mergeKeys: metadata !== undefined && metadata.mergeKeys === true });
  if (node === void 0) return;

  return getLoc(lineMap, {
    start: getStartPosition(node, lineMap.length > 0 ? lineMap[0] : 0),
    end: getEndPosition(node),
  });
};

function getStartPosition(node: YAMLNode | YAMLCompactNode, offset: number): number {
  if (node.parent && node.parent.kind === Kind.MAPPING) {
    // the parent is a mapping with no value, let's default to the end of node
    if (node.parent.value === null) {
      return node.parent.endPosition;
    }

    if (node.kind !== Kind.SCALAR) {
      return node.parent.key.endPosition + 1; // offset for colon
    }
  }

  if (node.parent === null && offset - node.startPosition === 0) {
    return 0;
  }

  return node.startPosition;
}

function getEndPosition(node: YAMLNode | YAMLCompactNode): number {
  switch (node.kind) {
    case Kind.SEQ:
      const { items } = node;
      if (items.length !== 0 && items[items.length - 1] !== null) {
        return getEndPosition(items[items.length - 1]);
      }
      break;
    case Kind.MAPPING:
      if (node.value !== null) {
        return getEndPosition(node.value);
      }

      break;
    case Kind.MAP:
      if (node.value !== null && node.mappings.length !== 0) {
        return getEndPosition(node.mappings[node.mappings.length - 1]);
      }
      break;
    case Kind.SCALAR:
      // the parent is a mapping with no value, let's default to the end of node
      if (node.parent !== null && node.parent.kind === Kind.MAPPING && node.parent.value === null) {
        return node.parent.endPosition;
      }

      break;
  }

  return node.endPosition;
}

type FindNodeOptions = { closest: boolean; mergeKeys: boolean };

function findNodeAtPath(node: YAMLNode, path: JsonPath, opts: FindNodeOptions): Optional<YAMLNode>;
function findNodeAtPath(node: YAMLCompactNode, path: JsonPath, opts: FindNodeOptions): Optional<YAMLCompactNode>;
function findNodeAtPath(node: YAMLNode | YAMLCompactNode, path: JsonPath, { closest, mergeKeys }: FindNodeOptions) {
  pathLoop: for (const segment of path) {
    if (!isObject(node)) {
      return closest ? node : void 0;
    }

    switch (node.kind) {
      case Kind.MAP:
        const mappings = getMappings(node.mappings, mergeKeys);
        // we iterate from the last to first to be compliant with JSONish mode
        // in other words, iterating from the last to first guarantees we choose the last node that might override other matching nodes
        for (let i = mappings.length - 1; i >= 0; i--) {
          const item = mappings[i];
          if (item.key.value === segment) {
            if (item.value === null) {
              node = item.key;
            } else {
              node = item.value;
            }
            continue pathLoop;
          }
        }

        return closest ? node : void 0;
      case Kind.SEQ:
        for (let i = 0; i < node.items.length; i++) {
          if (i === Number(segment)) {
            node = node.items[i];
            continue pathLoop;
          }
        }

        return closest ? node : void 0;
      default:
        return closest ? node : void 0;
    }
  }

  return node;
}

function getMappings(mappings: YAMLMapping[], mergeKeys: boolean): YAMLMapping[];
function getMappings(mappings: YAMLCompactMapping[], mergeKeys: boolean): YAMLCompactMapping[];
function getMappings(
  mappings: Array<YAMLMapping | YAMLCompactMapping>,
  mergeKeys: boolean,
): YAMLMapping[] | YAMLCompactMapping[] {
  if (!mergeKeys) return mappings;

  return mappings.reduce<Array<YAMLMapping | YAMLCompactMapping>>((mergedMappings, mapping) => {
    if (isObject(mapping)) {
      if (mapping.key.value === SpecialMappingKeys.MergeKey) {
        mergedMappings.push(...reduceMergeKeys(mapping.value));
      } else {
        mergedMappings.push(mapping);
      }
    }

    return mergedMappings;
  }, []);
}

function reduceMergeKeys(node: YAMLNode): YAMLMapping[];
function reduceMergeKeys(node: YAMLCompactNode): YAMLCompactMapping[];
function reduceMergeKeys(node: YAMLNode | YAMLCompactNode | undefined | null): YAMLMapping[] | YAMLCompactMapping[] {
  if (!isObject(node)) return [];

  switch (node.kind) {
    case Kind.SEQ:
      return node.items.reduceRight((items, item) => {
        items.push(...reduceMergeKeys(item));
        return items;
      }, []);
    case Kind.MAP:
      return node.mappings;
    case Kind.ANCHOR_REF:
      return reduceMergeKeys(node.value);
    default:
      return [];
  }
}

const getLoc = (lineMap: number[], { start = 0, end = 0 }): ILocation => {
  const startLine = lineForPosition(start, lineMap);
  const endLine = lineForPosition(end, lineMap);

  return {
    range: {
      start: {
        line: startLine,
        character: start - (startLine === 0 ? 0 : lineMap[startLine - 1]),
      },
      end: {
        line: endLine,
        character: end - (endLine === 0 ? 0 : lineMap[endLine - 1]),
      },
    },
  };
};

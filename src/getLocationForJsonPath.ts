import { GetLocationForJsonPath, ILocation, JsonPath } from '@stoplight/types';
import { Kind, YAMLMapping, YAMLNode, YAMLSequence } from 'yaml-ast-parser';
import { SpecialMappingKeys } from './consts';
import { lineForPosition } from './lineForPosition';
import { YamlParserResult } from './types';
import { isObject } from './utils';

export const getLocationForJsonPath: GetLocationForJsonPath<YamlParserResult<unknown>> = (
  { ast, lineMap, metadata },
  path,
  closest = false
) => {
  const node = findNodeAtPath(ast, path, { closest, mergeKeys: metadata !== undefined && metadata.mergeKeys === true });
  if (node === void 0) return;

  return getLoc(lineMap, {
    start: getStartPosition(node, lineMap.length > 0 ? lineMap[0] : 0),
    end: getEndPosition(node),
  });
};

function getStartPosition(node: YAMLNode, offset: number): number {
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

function getEndPosition(node: YAMLNode): number {
  switch (node.kind) {
    case Kind.SEQ:
      const { items } = node as YAMLSequence;
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

function findNodeAtPath(
  node: YAMLNode,
  path: JsonPath,
  { closest, mergeKeys }: { closest: boolean; mergeKeys: boolean }
) {
  pathLoop: for (const segment of path) {
    switch (node && node.kind) {
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
        for (let i = 0; i < (node as YAMLSequence).items.length; i++) {
          if (i === Number(segment)) {
            node = (node as YAMLSequence).items[i];
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

function getMappings(mappings: YAMLMapping[], mergeKeys: boolean): YAMLMapping[] {
  if (!mergeKeys) return mappings;

  return mappings.reduce<YAMLMapping[]>((mergedMappings, mapping) => {
    if (isObject(mapping)) {
      if (mapping.key.value === SpecialMappingKeys.MergeKey) {
        mergedMappings.push(...reduceMergeKeys((mapping as YAMLMapping).value));
      } else {
        mergedMappings.push(mapping);
      }
    }

    return mergedMappings;
  }, []);
}

function reduceMergeKeys(node: YAMLNode): YAMLMapping[] {
  switch (node.kind) {
    case Kind.SEQ:
      return (node as YAMLSequence).items.reduceRight<YAMLMapping[]>((items, item) => {
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

import { GetLocationForJsonPath, ILocation } from '@stoplight/types';
import { findNodeAtPath } from './findNodeAtPath';
import { lineForPosition } from './lineForPosition';
import { Kind, YAMLNode, YamlParserResult } from './types';

export const getLocationForJsonPath: GetLocationForJsonPath<YamlParserResult<unknown>> = (
  { ast, lineMap, metadata },
  path,
  closest = false,
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
      const { items } = node;
      if (items.length !== 0) {
        const lastItem = items[items.length - 1];
        if (lastItem !== null) {
          return getEndPosition(lastItem);
        }
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

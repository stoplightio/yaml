import { GetLocationForJsonPath, ILocation, JsonPath } from '@stoplight/types';
import { Kind, YAMLNode, YAMLSequence } from 'yaml-ast-parser';
import { lineForPosition } from './lineForPosition';

export const getLocationForJsonPath: GetLocationForJsonPath<YAMLNode, number[]> = ({ ast, lineMap }, path) => {
  const node = findNodeAtPath(ast, path);
  if (node === undefined) return;

  const { startPosition } = node;
  return getLoc(lineMap, { start: startPosition, end: getEndPosition(node).endPosition });
};

function getEndPosition(node: YAMLNode): YAMLNode {
  switch (node.kind) {
    case Kind.SEQ:
      const { items } = node as YAMLSequence;
      if (items.length === 0) {
        return node;
      }

      return getEndPosition(items[items.length - 1]);
    case Kind.MAPPING:
      if (node.value === null) {
        return node;
      }

      return getEndPosition(node.value);
    case Kind.MAP:
      if (node.value === null || node.mappings.length === 0) {
        return node;
      }

      return getEndPosition(node.mappings[node.mappings.length - 1]);
  }

  return node;
}

function findNodeAtPath(node: YAMLNode, path: JsonPath) {
  pathLoop: for (const segment of path) {
    switch (node.kind) {
      case Kind.MAP:
        for (const item of node.mappings) {
          if (item.key.value === segment) {
            node = item.value;
            continue pathLoop;
          }
        }
        break;
      case Kind.SEQ:
        for (let i = 0; i < (node as YAMLSequence).items.length; i++) {
          if (i === Number(segment)) {
            node = (node as YAMLSequence).items[i];
            continue pathLoop;
          }
        }
        break;
    }
  }

  return node;
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
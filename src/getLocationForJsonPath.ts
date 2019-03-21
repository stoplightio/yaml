import { GetLocationForJsonPath, ILocation, JsonPath } from '@stoplight/types';
import { Kind, YAMLNode, YAMLSequence } from 'yaml-ast-parser';
import { lineForPosition } from './lineForPosition';

export const getLocationForJsonPath: GetLocationForJsonPath<YAMLNode, number[]> = ({ ast, lineMap }, path) => {
  const node = findNodeAtPath(ast, path);
  if (node === undefined) return;

  const { startPosition, endPosition } = node;
  return getLoc(lineMap, { start: startPosition, end: endPosition });
};

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
          if (i === segment) {
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
  console.log(start, end);
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

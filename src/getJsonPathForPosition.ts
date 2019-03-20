import { GetJsonPathForPosition, JsonPath } from '@stoplight/types';
import { YAMLNode } from 'yaml-ast-parser';

export const getJsonPathForPosition: GetJsonPathForPosition<YAMLNode, number[]> = (
  { ast, lineMap },
  { line, character }
) => {
  if (line >= lineMap.length || character >= lineMap[line]) {
    return;
  }

  const path: JsonPath = [];
  const endOffset = line === 0 ? 0 : lineMap[line - 1];

  findNodeAtOffset(ast, Math.min(lineMap[line], endOffset + character), path);
  return path;
};

function findNodeAtOffset(node: YAMLNode, offset: number, path: JsonPath): YAMLNode | undefined {
  if (offset >= node.startPosition && offset < node.endPosition) {
    const { mappings } = node;
    if (Array.isArray(mappings)) {
      for (const mapping of mappings) {
        const item = findNodeAtOffset(mapping, offset, path);
        if (item) {
          path.push(item.key.value);
          return findNodeAtOffset(item.value, offset, path);
        }
      }
    }

    return node;
  }

  return;
}

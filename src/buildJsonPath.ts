import { JsonPath } from '@stoplight/types';
import { Kind, YAMLASTNode } from './types';
import { isObject } from './utils';

export function buildJsonPath(node: YAMLASTNode): JsonPath {
  const path: JsonPath = [];

  let prevNode = node;

  while (node) {
    switch (node.kind) {
      case Kind.SCALAR:
        path.unshift(node.value);
        break;
      case Kind.MAPPING:
        if (prevNode !== node.key) {
          if (path.length > 0 && isObject(node.value) && node.value.value === path[0]) {
            path[0] = node.key.value;
          } else {
            path.unshift(node.key.value);
          }
        }
        break;
      case Kind.SEQ:
        if (prevNode) {
          const index = (node.items as YAMLASTNode[]).indexOf(prevNode);
          if (prevNode.kind === Kind.SCALAR) {
            path[0] = index;
            // always better to point to parent node rather than nothing
          } else if (index !== -1) {
            path.unshift(index);
          }
        }
        break;
    }

    prevNode = node;
    node = node.parent;
  }

  return path;
}

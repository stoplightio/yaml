import { JsonPath } from '@stoplight/types';
import { Kind, YAMLMapping, YAMLNode, YAMLScalar, YAMLSequence } from 'yaml-ast-parser';
import { isValidNode } from './utils';

export function buildJsonPath(node: YAMLNode) {
  const path: JsonPath = [];

  let prevNode: YAMLNode = node;

  while (node) {
    switch (node.kind) {
      case Kind.SCALAR:
        path.unshift((node as YAMLScalar).value);
        break;
      case Kind.MAPPING:
        if (prevNode !== (node as YAMLMapping).key) {
          if (
            path.length > 0 &&
            isValidNode((node as YAMLMapping).value) &&
            (node as YAMLMapping).value.value === path[0]
          ) {
            path[0] = (node as YAMLMapping).key.value;
          } else {
            path.unshift((node as YAMLMapping).key.value);
          }
        }
        break;
      case Kind.SEQ:
        if (prevNode) {
          const index = (node as YAMLSequence).items.indexOf(prevNode);
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

import { Kind } from '@stoplight/yaml-ast-parser';
import { YAMLAnchorIgnoreKeys, YAMLNode, YAMLScalarIgnoreKeys } from './types';
import { isObject } from './utils';

const ANCHOR_IGNORE_KEYS: YAMLAnchorIgnoreKeys[] = ['referencesAnchor', 'anchorId'];
const SCALAR_IGNORE_KEYS: YAMLScalarIgnoreKeys[] = ['doubleQuoted', 'singleQuoted', 'plainScalar', 'rawValue'];

export function compact(node: YAMLNode): void {
  delete node.errors;

  switch (node.kind) {
    case Kind.ANCHOR_REF:
      for (const key of ANCHOR_IGNORE_KEYS) {
        delete node[key];
      }

      break;
    case Kind.SCALAR:
      for (const key of SCALAR_IGNORE_KEYS) {
        delete node[key];
      }

      break;
    case Kind.SEQ:
      for (const item of node.items) {
        if (isObject(item)) {
          compact(item);
        }
      }
      break;

    case Kind.MAPPING:
      compact(node.key);
      if (isObject(node.value)) {
        compact(node.value);
      }

      break;
    case Kind.MAP:
      for (const map of node.mappings) {
        if (isObject(map)) {
          compact(map);
        }
      }

      break;
    default:
  }
}

import { JsonPath, Optional } from '@stoplight/types';
import { SpecialMappingKeys } from './consts';
import { Kind, YAMLMapping, YAMLNode } from './types';
import { isObject } from './utils';

export function findNodeAtPath(
  node: YAMLNode,
  path: JsonPath,
  { closest, mergeKeys }: { closest: boolean; mergeKeys: boolean },
) {
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
            const item = node.items[i];
            if (item === null) {
              break;
            }

            node = item;
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
        mergedMappings.push(...reduceMergeKeys(mapping.value));
      } else {
        mergedMappings.push(mapping);
      }
    }

    return mergedMappings;
  }, []);
}

function reduceMergeKeys(node: Optional<YAMLNode | null>): YAMLMapping[] {
  if (!isObject(node)) return [];

  switch (node.kind) {
    case Kind.SEQ:
      return node.items.reduceRight<YAMLMapping[]>((items, item) => {
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

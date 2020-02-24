import { Kind, YAMLAnchorReference, YAMLMapping, YAMLNode } from './types';
import { isObject } from './utils';

export const dereferenceAnchor = (node: YAMLNode | null, anchorId: string): YAMLNode | null => {
  if (!isObject(node)) return node;
  if (node.kind === Kind.ANCHOR_REF && node.referencesAnchor === anchorId) return null;

  switch (node.kind) {
    case Kind.MAP:
      return {
        ...node,
        mappings: node.mappings.map(mapping => dereferenceAnchor(mapping, anchorId) as YAMLMapping),
      };
    case Kind.SEQ:
      return {
        ...node,
        items: node.items.map(item => dereferenceAnchor(item, anchorId)!),
      };
    case Kind.MAPPING:
      return { ...node, value: dereferenceAnchor(node.value, anchorId) };
    case Kind.SCALAR:
      return node;
    case Kind.ANCHOR_REF:
      if (isObject(node.value) && isSelfReferencingAnchorRef(node)) {
        return null;
      }

      return node;
    default:
      return node;
  }
};

const isSelfReferencingAnchorRef = (anchorRef: YAMLAnchorReference) => {
  const { referencesAnchor } = anchorRef;
  let node: YAMLNode | undefined = anchorRef;
  // tslint:disable-next-line:no-conditional-assignment
  while ((node = node.parent)) {
    if ('anchorId' in node && node.anchorId === referencesAnchor) {
      return true;
    }
  }

  return false;
};

import { GetJsonPathForPosition, JsonPath } from '@stoplight/types';
import { Kind, YamlMap, YAMLNode, YAMLSequence } from 'yaml-ast-parser';

export const getJsonPathForPosition: GetJsonPathForPosition<YAMLNode, number[]> = (
  { ast, lineMap },
  { line, character }
) => {
  if (line >= lineMap.length || character >= lineMap[line]) {
    return;
  }

  const startOffset = line === 0 ? 0 : lineMap[line - 1];

  const node = findNodeAtOffset(ast, startOffset, lineMap[line]);
  if (!node) return node;
  return buildJsonPath(node);
};

function* walk(node: YAMLNode): IterableIterator<YAMLNode> {
  switch (node.kind) {
    case Kind.MAP:
      for (const mapping of (node as YamlMap).mappings) {
        yield* walk(mapping);
      }

      break;
    case Kind.MAPPING:
      yield node.key;
      if (node.value.kind === Kind.MAP || node.value.kind === Kind.SEQ) {
        yield* walk(node.value);
      } else {
        yield node.value;
      }
      break;
    case Kind.SEQ:
      for (const item of (node as YAMLSequence).items) {
        yield* walk(item);
      }
      break;
    case Kind.SCALAR:
      yield node;
      break;
    case Kind.ANCHOR_REF:
      // todo: shall we handle it? might be good to iterate over value if Map or so
      break;
  }
}

function findNodeAtOffset(ast: YAMLNode, offset: number, endOffset: number) {
  for (const node of walk(ast)) {
    switch (node.kind) {
      case Kind.SCALAR:
        if (offset <= node.startPosition && endOffset >= node.endPosition) {
          return node;
        }
    }
  }

  return;
}

function buildJsonPath(node: YAMLNode) {
  const path: JsonPath = [];

  let prevNode: YAMLNode = node;

  while (node) {
    switch (node.kind) {
      case Kind.SCALAR:
        path.unshift(node.value);
        break;
      case Kind.MAPPING:
        if (prevNode !== node.key) {
          path.unshift(node.key.value);
        }
        break;
      case Kind.SEQ:
        if (prevNode) {
          const index = (node as YAMLSequence).items.indexOf(prevNode);
          if (prevNode.kind === Kind.SCALAR) {
            path[0] = index;
          } else {
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

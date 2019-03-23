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

  const node = findClosestNode(ast, Math.min(lineMap[line] - 1, startOffset + character), lineMap[line - 1] - 1);
  if (!node) return;

  return buildJsonPath(node);
};

function* walk(node: YAMLNode): IterableIterator<YAMLNode> {
  switch (node.kind) {
    case Kind.MAP:
      for (const mapping of (node as YamlMap).mappings) {
        yield mapping;
        yield* walk(mapping);
      }
      break;
    case Kind.MAPPING:
      yield node.key;
      if (node.value !== null) {
        yield node.value;

        if (node.value.kind === Kind.MAP || node.value.kind === Kind.SEQ) {
          yield* walk(node.value);
        }
      }
      break;
    case Kind.SEQ:
      for (const item of (node as YAMLSequence).items) {
        yield item;
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

function getFirstScalarChild(node: YAMLNode, offset: number): YAMLNode {
  switch (node.kind) {
    case Kind.MAPPING:
      return node.key;
    case Kind.MAP:
      if (node.value !== null && node.mappings.length !== 0) {
        for (const mapping of node.mappings) {
          if (mapping.startPosition >= offset) {
            return getFirstScalarChild(mapping, offset);
          }
        }
      }

      break;
    case Kind.SEQ:
      if ((node as YAMLSequence).items.length !== 0) {
        for (const item of (node as YAMLSequence).items) {
          if (item.startPosition >= offset) {
            return item;
          }
        }
      }

      break;
  }

  return node;
}

function findClosestNode(container: YAMLNode, offset: number, lineEndOffset: number): YAMLNode | void {
  for (const node of walk(container)) {
    if (node.startPosition <= offset && offset <= node.endPosition) {
      return node.kind === Kind.SCALAR ? node : findClosestNode(node, offset, lineEndOffset);
    }
  }

  if (container.startPosition <= lineEndOffset && offset <= container.endPosition) {
    if (container.kind !== Kind.MAPPING) {
      return getFirstScalarChild(container, lineEndOffset);
    }

    if (container.value && container.key.endPosition < offset) {
      return getFirstScalarChild(container.value, lineEndOffset);
    }
  }

  return container;
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
          if (path.length > 0 && node.value !== null && node.value.value === path[0]) {
            path[0] = node.key.value;
          } else {
            path.unshift(node.key.value);
          }
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

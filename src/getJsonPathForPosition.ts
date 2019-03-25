import { GetJsonPathForPosition, JsonPath } from '@stoplight/types';
import { Kind, YamlMap, YAMLNode, YAMLSequence } from 'yaml-ast-parser';

export const getJsonPathForPosition: GetJsonPathForPosition<YAMLNode, number[]> = (
  { ast, lineMap },
  { line, character }
) => {
  if (line >= lineMap.length || character >= lineMap[line]) {
    return;
  }

  const startOffset = line === 0 ? 0 : lineMap[line - 1] + 1;

  const node = findClosestScalar(ast, Math.min(lineMap[line] - 1, startOffset + character), line, lineMap);
  if (!node) return;

  const path = buildJsonPath(node);
  if (path.length === 0) return;
  return path;
};

const isValidNode = (node: YAMLNode) => node !== null && node !== undefined;

function* walk(node: YAMLNode): IterableIterator<YAMLNode> {
  switch (node.kind) {
    case Kind.MAP:
      if (node.mappings.length !== 0) {
        for (const mapping of (node as YamlMap).mappings) {
          if (isValidNode(mapping)) {
            yield mapping;
            yield* walk(mapping);
          }
        }
      }

      break;
    case Kind.MAPPING:
      if (isValidNode(node.key)) {
        yield node.key;
      }

      if (isValidNode(node.value)) {
        yield node.value;

        if (node.value.kind === Kind.MAP || node.value.kind === Kind.SEQ) {
          yield* walk(node.value);
        }
      }

      break;
    case Kind.SEQ:
      if ((node as YAMLSequence).items.length !== 0) {
        for (const item of (node as YAMLSequence).items) {
          if (isValidNode(item)) {
            yield item;
            yield* walk(item);
          }
        }
      }

      break;
    case Kind.SCALAR:
      yield node;
      break;
  }
}

function getFirstScalarChild(node: YAMLNode, line: number, lineMap: number[]): YAMLNode {
  const startOffset = lineMap[line - 1] + 1;
  const endOffset = lineMap[line];

  switch (node.kind) {
    case Kind.MAPPING:
      return node.key;
    case Kind.MAP:
      if (node.mappings.length !== 0) {
        for (const mapping of node.mappings) {
          if (mapping.startPosition > startOffset && mapping.startPosition <= endOffset) {
            return getFirstScalarChild(mapping, line, lineMap);
          }
        }
      }

      break;
    case Kind.SEQ:
      if ((node as YAMLSequence).items.length !== 0) {
        for (const item of (node as YAMLSequence).items) {
          if (item.startPosition > startOffset && item.startPosition <= endOffset) {
            return getFirstScalarChild(item, line, lineMap);
          }
        }
      }

      break;
  }

  return node;
}

function findClosestScalar(container: YAMLNode, offset: number, line: number, lineMap: number[]): YAMLNode | void {
  for (const node of walk(container)) {
    if (node.startPosition <= offset && offset <= node.endPosition) {
      return node.kind === Kind.SCALAR ? node : findClosestScalar(node, offset, line, lineMap);
    }
  }
  if (lineMap[line - 1] === lineMap[line] - 1) {
    // empty line
    return container;
  }

  // narrow the lookup, try to find closest node bound to given line
  if (container.startPosition < lineMap[line - 1] && offset <= container.endPosition) {
    if (container.kind !== Kind.MAPPING) {
      return getFirstScalarChild(container, line, lineMap);
    }

    if (container.value && container.key.endPosition < offset) {
      return getFirstScalarChild(container.value, line, lineMap);
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
          if (path.length > 0 && isValidNode(node.value) && node.value.value === path[0]) {
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

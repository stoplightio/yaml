import { GetJsonPathForPosition } from '@stoplight/types';
import { buildJsonPath } from './buildJsonPath';
import { Kind, YAMLNode, YamlParserResult } from './types';
import { isObject } from './utils';

export const getJsonPathForPosition: GetJsonPathForPosition<YamlParserResult<unknown>> = (
  { ast, lineMap },
  { line, character },
) => {
  if (line >= lineMap.length || character >= lineMap[line]) {
    return;
  }

  const startOffset = line === 0 ? 0 : lineMap[line - 1] + 1;

  const node = findClosestScalar(ast, Math.min(lineMap[line] - 1, startOffset + character), line, lineMap);
  if (!isObject(node)) return;

  const path = buildJsonPath(node);
  if (path.length === 0) return;
  return path;
};

function* walk(node: YAMLNode): IterableIterator<YAMLNode> {
  switch (node.kind) {
    case Kind.MAP:
      if (node.mappings.length !== 0) {
        for (const mapping of node.mappings) {
          if (isObject(mapping)) {
            yield mapping;
          }
        }
      }

      break;
    case Kind.MAPPING:
      if (isObject(node.key)) {
        yield node.key;
      }

      if (isObject(node.value)) {
        yield node.value;
      }

      break;
    case Kind.SEQ:
      if (node.items.length !== 0) {
        for (const item of node.items) {
          if (isObject(item)) {
            yield item;
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
      if (node.items.length !== 0) {
        for (const item of node.items) {
          if (item !== null && item.startPosition > startOffset && item.startPosition <= endOffset) {
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

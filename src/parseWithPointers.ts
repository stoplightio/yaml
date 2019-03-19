import {
  IParserResult,
  JSONPath,
  IPosition,
  ILocation,
  IDiagnostic,
  DiagnosticSeverity
} from '@stoplight/types';
import { load as loadAST, YAMLException, YAMLNode } from 'yaml-ast-parser';

import get = require('lodash/get');

export const parseWithPointers = <T>(value: string): IParserResult<T> => {
  const lineMap = computeLineMap(value);
  const ast = loadAST(value);

  const parsed: IParserResult<T> = {
    data: {} as T,
    diagnostics: [],
    getJsonPathForPosition({ line, character }: IPosition): JSONPath | undefined {
      if (line >= lineMap.length || character >= lineMap[line]) {
        return;
      }

      const path: JSONPath = [];
      findNodeAtOffset(ast, (line === 0 ? 0 : lineMap[line - 1]) + character, path);
      return path;
    },
    getLocationForJsonPath(path: JSONPath): ILocation | undefined {
      const node = findNodeAtPath(ast, path);
      if (node === undefined) return;

      const { startPosition, endPosition } = node;
      console.log(lineMap.indexOf(endPosition));
      return getLoc(lineMap, { start: startPosition, end: endPosition });
    }
  };

  if (!ast) return parsed;

  walk<T>(parsed.data, ast.mappings, lineMap);

  if (ast.errors) {
    parsed.diagnostics = transformErrors(ast.errors);
  }

  return parsed;
};

/**
 * A performant way to find the appropriate line for the given position.
 *
 * This is key to making the yaml line mapping performant.
 */
export const lineForPosition = (pos: number, lines: number[], start: number = 0, end?: number): number => {
  // position 0 is always line 0
  if (pos === 0) {
    return 0;
  }

  // start with max range, 0 - lines.length
  if (typeof end === 'undefined') {
    end = lines.length;
  }

  // target should be the halfway point between start and end
  const target = Math.floor((end - start) / 2) + start;
  if (pos >= lines[target] && !lines[target + 1]) {
    return target + 1;
  }

  // if pos is between target and the next line's position, we're good!
  const nextLinePos = lines[Math.min(target + 1, lines.length)];

  if (pos === lines[target]) {
    return target;
  }

  if (pos >= lines[target] && pos <= nextLinePos) {
    if (pos === nextLinePos) {
      return target + 2;
    }

    return target + 1;
  }

  // if pos is above the current line position, then we need to go "up"
  if (pos > lines[target]) {
    return lineForPosition(pos, lines, target + 1, end);
  } else {
    // else we take the bottom half
    return lineForPosition(pos, lines, start, target - 1);
  }
};

const walk = <T>(
  container: T,
  nodes: YAMLNode[],
  lineMap: number[],
) => {
  for (const i in nodes) {
    if (!nodes.hasOwnProperty(i)) continue;

    const index = parseInt(i);
    const node = nodes[index];
    const key = node.key ? node.key.value : index;

    const mappings = get(node, 'mappings', get(node, 'value.mappings'));
    if (mappings) {
      container[key] = walk({}, mappings, lineMap);
      continue;
    }

    const items = get(node, 'items', get(node, 'value.items'));
    if (items) {
      container[key] = walk([], items, lineMap);
      continue;
    }

    if (node) {
      if (node.hasOwnProperty('valueObject')) {
        container[key] = node.valueObject;
      } else if (node.hasOwnProperty('value')) {
        if (node.value && node.value.hasOwnProperty('valueObject')) {
          container[key] = node.value.valueObject;
        } else if (node.value && node.value.hasOwnProperty('value')) {
          container[key] = node.value.value;
        } else {
          container[key] = node.value;
        }
      }
    } else {
      container[key] = node;
    }
  }

  return container;
};

// builds up the line map, for use by linesForPosition
const computeLineMap = (input: string) => {
  // fixme: support CRLF and CR
  const lines = input.split(/\n/);
  const lineMap: number[] = [];

  let sum = 0;
  for (const line of lines) {
    sum += line.length + 1; // todo: verify how combining marks and such are treated by yaml parser
    lineMap.push(sum);
  }

  return lineMap;
};

const getLoc = (lineMap: number[], { start = 0, end = 0 }): ILocation => {
  const startLine = lineForPosition(start, lineMap);
  const endLine = lineForPosition(end, lineMap);
  return {
    range: {
      start: {
        line: startLine,
        character: start - lineMap[startLine - 1],
      },
      end: {
        line: endLine,
        character: end - lineMap[endLine - 1]
      },
    }
  };
};

const transformErrors = (errors: YAMLException[]): any[] => {
  const validations: IDiagnostic[] = [];
  for (const error of errors) {
    const validation: IDiagnostic = {
      code: error.name,
      message: error.reason,
      severity: error.isWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
      range: {
        start: {
          line: error.mark.line,
          character: error.mark.column,
        },
        end: {
          line: error.mark.line,
          character: error.mark.position, // todo: shall we consume toLineEnd?
        }
      }
    };

    validations.push(validation);
  }

  return validations;
};

function findNodeAtOffset(node: YAMLNode, offset: number, path: JSONPath): YAMLNode | undefined {
  if (offset >= node.startPosition && offset < node.endPosition) {
    const { mappings } = node;
    if (Array.isArray(mappings)) {
      for (let i = 0; i < mappings.length; i++) {
        let item = findNodeAtOffset(mappings[i], offset, path);
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

function findNodeAtPath(node: YAMLNode, path: JSONPath) {
  pathLoop:
  for (const segment of path) {
    if (Array.isArray(node.mappings)) {
      for (const item of node.mappings) {
        if (item.key.value === segment) {
          node = item.value;
          continue pathLoop;
        }
      }

      return;
    }

    return node.parent;
  }

  return node.parent;
}

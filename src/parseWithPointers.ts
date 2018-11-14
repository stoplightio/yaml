import { IParserResult, IParserResultPointers } from '@stoplight/types';
import { load as loadAST, YAMLException } from 'yaml-ast-parser';

// import { IParser, IParserResult, IParserResultPointers, MessageSeverity } from '../../types';

const get = require('lodash/get');

export interface IYamlParserOpts {
  // Increase performance by limiting how deep into the object we recurse to generate pointers.
  maxPointerDepth?: number;
}

export const parseWithPointers = <T>(value: string, opts: IYamlParserOpts = {}): IParserResult<T> => {
  const parsed: IParserResult = {
    data: {},
    pointers: {},
    validations: [],
  };

  if (!value || !value.trim().length) return parsed;

  const ast = loadAST(value);
  if (!ast) return parsed;

  const lineMap = computeLineMap(value);

  parsed.pointers = {
    '': getLoc(lineMap, {
      start: 0,
      end: ast.endPosition,
    }),
  };

  parsed.data = walk([], {}, ast.mappings, parsed.pointers, lineMap, 1, opts);

  if (ast.errors) {
    parsed.validations = transformErrors(ast.errors);
  }

  return parsed;
};

/**
 * A performant way to find the appropriate line for the given position.
 *
 * This is key to making the yaml line mapping performant.
 */
export const lineForPosition = (pos: number, lines: number[], start: number = 0, end?: number): number => {
  // position 0 is always line 1
  if (pos === 0) {
    return 1;
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

const walk = (
  path: string[],
  container: any,
  nodes: any[],
  pointers: IParserResultPointers,
  lineMap: number[],
  depth: number,
  opts: IYamlParserOpts
) => {
  if (opts.maxPointerDepth && opts.maxPointerDepth < depth) return container;

  for (const i in nodes) {
    if (!nodes.hasOwnProperty(i)) continue;

    const index = parseInt(i);
    const node = nodes[index];
    const key = node.key ? node.key.value : index;
    const nodePath = path.concat(key);

    pointers[`/${nodePath.join('/')}`] = getLoc(lineMap, {
      start: node.startPosition,
      end: node.endPosition,
    });

    const mappings = get(node, 'mappings', get(node, 'value.mappings'));
    if (mappings) {
      container[key] = walk(nodePath, {}, mappings, pointers, lineMap, depth + 1, opts);
      continue;
    }

    const items = get(node, 'items', get(node, 'value.items'));
    if (items) {
      container[key] = walk(nodePath, [], items, pointers, lineMap, depth + 1, opts);
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
  const lines = input.split(/\n/);
  const lineMap: number[] = [];

  let sum = 0;
  for (const line of lines) {
    lineMap.push(sum);
    sum += line.length + 1;
  }

  return lineMap;
};

const getLoc = (lineMap: number[], { start = 0, end = 0 }) => {
  return {
    start: { line: lineForPosition(start, lineMap) },
    end: { line: lineForPosition(end, lineMap) },
  };
};

const transformErrors = (errors: YAMLException[]): any[] => {
  const validations: any[] = [];
  for (const error of errors) {
    const validation: any = {
      ruleId: error.name,
      msg: error.reason,
      // FIXME when LogLevel enum published in types package: error.isWarning ? LogLevel.Warn : LogLevel.Fatal
      level: error.isWarning ? 40 : 60,
    };

    if (error.mark && error.mark.line) {
      validation.location = {
        start: {
          line: error.mark.line,
        },
      };
    }

    validations.push(validation);
  }

  return validations;
};

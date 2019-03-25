import { DiagnosticSeverity, IDiagnostic, IParserResult } from '@stoplight/types';
import { load as loadAST, YAMLException, YAMLNode } from 'yaml-ast-parser';

import get = require('lodash/get');

export const parseWithPointers = <T>(value: string): IParserResult<T, YAMLNode, number[]> => {
  const lineMap = computeLineMap(value);
  const ast = loadAST(value);

  const parsed: IParserResult<T, YAMLNode, number[]> = {
    ast,
    lineMap,
    data: {} as T,
    diagnostics: [],
  };

  if (!ast) return parsed;

  walk<T>(parsed.data, ast.mappings, lineMap);

  if (ast.errors) {
    parsed.diagnostics = transformErrors(ast.errors, lineMap);
  }

  return parsed;
};

const walk = <T>(container: T, nodes: YAMLNode[], lineMap: number[]) => {
  for (const i in nodes) {
    if (!nodes.hasOwnProperty(i)) continue;

    const index = parseInt(i);
    const node = nodes[index];
    if (node === null) continue;

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
  const lines = input.split(/\n/);
  const lineMap: number[] = [];

  let sum = 0;
  for (const line of lines) {
    sum += line.length + 1;
    lineMap.push(sum);
  }

  return lineMap;
};

const transformErrors = (errors: YAMLException[], lineMap: number[]): IDiagnostic[] => {
  const validations: IDiagnostic[] = [];
  for (const error of errors) {
    const validation: IDiagnostic = {
      code: error.name,
      message: error.reason,
      severity: error.isWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
      range: {
        start: {
          line: error.mark.line - 1,
          character: error.mark.column,
        },
        end: {
          line: error.mark.line - 1,
          character: error.mark.toLineEnd ? lineMap[error.mark.line - 1] : error.mark.column,
        },
      },
    };

    validations.push(validation);
  }

  return validations;
};

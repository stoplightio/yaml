import { DiagnosticSeverity, IDiagnostic, IParserResult } from '@stoplight/types';
import { Kind, load as loadAST, YAMLException, YamlMap, YAMLNode, YAMLSequence } from 'yaml-ast-parser';

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

  parsed.data = walk(ast) as T;

  if (ast.errors) {
    parsed.diagnostics = transformErrors(ast.errors, lineMap);
  }

  return parsed;
};

const walk = (node: YAMLNode | null): unknown => {
  if (node) {
    switch (node.kind) {
      case Kind.MAP: {
        const container = {};
        // note, we don't handle null aka '~' keys on purpose
        for (const mapping of (node as YamlMap).mappings) {
          // typing is broken, value might be null
          container[mapping.key.value] = walk(mapping.value);
        }

        return container;
      }
      case Kind.SEQ:
        return (node as YAMLSequence).items.map(item => walk(item));
      case Kind.SCALAR:
        return 'valueObject' in node ? node.valueObject : node.value;
      case Kind.ANCHOR_REF:
        return;
      default:
        return null;
    }
  }

  return node;
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

function getLineLength(lineMap: number[], line: number) {
  if (line === 0) {
    return Math.max(0, lineMap[0] - 1);
  }

  return Math.max(0, lineMap[line] - lineMap[line - 1] - 1);
}

const transformErrors = (errors: YAMLException[], lineMap: number[]): IDiagnostic[] => {
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
          character: error.mark.toLineEnd ? getLineLength(lineMap, error.mark.line) : error.mark.column,
        },
      },
    };

    validations.push(validation);
  }

  return validations;
};

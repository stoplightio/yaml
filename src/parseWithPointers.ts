import { DiagnosticSeverity, IDiagnostic } from '@stoplight/types';
import {
  Kind,
  load as loadAST,
  LoadOptions,
  YAMLAnchorReference,
  YAMLException,
  YamlMap,
  YAMLNode,
  YAMLSequence,
} from 'yaml-ast-parser';
import { buildJsonPath } from './buildJsonPath';
import { lineForPosition } from './lineForPosition';
import { YamlParserResult } from './types';

export const parseWithPointers = <T>(value: string, options?: LoadOptions): YamlParserResult<T> => {
  const lineMap = computeLineMap(value);
  const ast = loadAST(value, {
    ...options,
    ignoreDuplicateKeys: true,
  });

  const parsed: YamlParserResult<T> = {
    ast,
    lineMap,
    data: {} as T, // fixme: we most likely should have undefined here, but this might be breaking
    diagnostics: [],
  };

  if (!ast) return parsed;

  const duplicatedMappingKeys: YAMLNode[] = [];

  parsed.data = walkAST(
    ast,
    options !== undefined && options.ignoreDuplicateKeys === false ? duplicatedMappingKeys : undefined
  ) as T;

  if (duplicatedMappingKeys.length > 0) {
    parsed.diagnostics.push(...transformDuplicatedMappingKeys(duplicatedMappingKeys, lineMap));
  }

  if (ast.errors) {
    parsed.diagnostics.push(...transformErrors(ast.errors, lineMap));
  }

  if (parsed.diagnostics.length > 0) {
    parsed.diagnostics.sort((itemA, itemB) => itemA.range.start.line - itemB.range.start.line);
  }

  return parsed;
};

export const walkAST = (node: YAMLNode | null, duplicatedMappingKeys?: YAMLNode[]): unknown => {
  if (node) {
    switch (node.kind) {
      case Kind.MAP: {
        const container = {};
        // note, we don't handle null aka '~' keys on purpose
        for (const mapping of (node as YamlMap).mappings) {
          // typing is broken, value might be null
          if (duplicatedMappingKeys !== undefined && mapping.key.value in container) {
            duplicatedMappingKeys.push(mapping.key);
          }

          container[mapping.key.value] = walkAST(mapping.value, duplicatedMappingKeys);
        }

        return container;
      }
      case Kind.SEQ:
        return (node as YAMLSequence).items.map(item => walkAST(item, duplicatedMappingKeys));
      case Kind.SCALAR:
        return 'valueObject' in node ? node.valueObject : node.value;
      case Kind.ANCHOR_REF:
        if (node.value !== void 0 && isCircularAnchorRef(node as YAMLAnchorReference)) {
          node.value = dereferenceAnchor(node.value, (node as YAMLAnchorReference).referencesAnchor);
        }

        return walkAST(node.value, duplicatedMappingKeys);
      default:
        return null;
    }
  }

  return node;
};

const isCircularAnchorRef = (anchorRef: YAMLAnchorReference) => {
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

const dereferenceAnchor = (node: YAMLNode, anchorId: string): YAMLNode | YAMLNode[] | void => {
  if (!node) return node;
  if ('referencesAnchor' in node && (node as YAMLAnchorReference).referencesAnchor === anchorId) return;

  switch (node.kind) {
    case Kind.MAP:
      return {
        ...node,
        mappings: (node as YamlMap).mappings.map(mapping => dereferenceAnchor(mapping, anchorId) as YAMLNode),
      } as YamlMap;
    case Kind.SEQ:
      return {
        ...node,
        items: (node as YAMLSequence).items.map(item => dereferenceAnchor(item, anchorId) as YAMLNode),
      } as YAMLSequence;
    case Kind.MAPPING:
      return { ...node, value: dereferenceAnchor(node.value, anchorId) };
    case Kind.SCALAR:
      return node;
    case Kind.ANCHOR_REF:
      if (node.value !== undefined && isCircularAnchorRef(node as YAMLAnchorReference)) {
        return;
      }

      return node;
    default:
      return node;
  }
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

const transformDuplicatedMappingKeys = (nodes: YAMLNode[], lineMap: number[]): IDiagnostic[] => {
  const validations: IDiagnostic[] = [];
  for (const node of nodes) {
    const startLine = lineForPosition(node.startPosition, lineMap);
    const endLine = lineForPosition(node.endPosition, lineMap);

    validations.push({
      code: 'YAMLException',
      message: 'duplicate key',
      path: buildJsonPath(node),
      range: {
        start: {
          line: startLine,
          character: startLine === 0 ? node.startPosition : node.startPosition - lineMap[startLine - 1],
        },
        end: {
          line: endLine,
          character: endLine === 0 ? node.endPosition : node.endPosition - lineMap[endLine - 1],
        },
      },
      severity: DiagnosticSeverity.Error,
    });
  }

  return validations;
};

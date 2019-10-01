import { DiagnosticSeverity, IDiagnostic } from '@stoplight/types';
import {
  determineScalarType,
  Kind,
  load as loadAST,
  parseYamlBoolean,
  parseYamlFloat,
  parseYamlInteger,
  ScalarType,
  YAMLAnchorReference,
  YAMLException,
  YamlMap,
  YAMLNode,
  YAMLScalar,
  YAMLSequence,
} from '@stoplight/yaml-ast-parser';
import { buildJsonPath } from './buildJsonPath';
import { SpecialMappingKeys } from './consts';
import { lineForPosition } from './lineForPosition';
import { IParseOptions, YamlParserResult } from './types';

export const parseWithPointers = <T>(value: string, options?: IParseOptions): YamlParserResult<T | undefined> => {
  const lineMap = computeLineMap(value);
  const ast = loadAST(value, {
    ...options,
    ignoreDuplicateKeys: true,
  });

  const parsed: YamlParserResult<T | undefined> = {
    ast,
    lineMap,
    data: undefined,
    diagnostics: [],
    metadata: options,
  };

  if (!ast) return parsed;

  const duplicatedMappingKeys: YAMLNode[] = [];

  parsed.data = walkAST(
    ast,
    options,
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

  if (Array.isArray(parsed.ast.errors)) {
    parsed.ast.errors.length = 0;
  }

  return parsed;
};

const seenKeys = ['']; // let us avoid the elements transition from PACKED_SMI_ELEMENTS to PACKED_ELEMENTS on V8

export const walkAST = (
  node: YAMLNode | null,
  options?: IParseOptions,
  duplicatedMappingKeys?: YAMLNode[]
): unknown => {
  if (node) {
    switch (node.kind) {
      case Kind.MAP: {
        const container = {};
        seenKeys.length = 0;
        // note, we don't handle null aka '~' keys on purpose
        const handleMergeKeys = options !== void 0 && options.mergeKeys === true;
        const handleDuplicates = (options !== void 0 && options.json === false) || duplicatedMappingKeys !== void 0;

        for (const mapping of (node as YamlMap).mappings) {
          const key = mapping.key.value;

          if (handleDuplicates && (!handleMergeKeys || key !== SpecialMappingKeys.MergeKey)) {
            if (seenKeys.includes(mapping.key.value)) {
              if (options !== void 0 && options.json === false) {
                throw new Error('Duplicate YAML mapping key encountered');
              }

              if (duplicatedMappingKeys !== void 0) {
                duplicatedMappingKeys.push(mapping.key);
              }
            } else {
              seenKeys.push(key);
            }
          }

          // https://yaml.org/type/merge.html merge keys, not a part of YAML spec
          if (handleMergeKeys && key === SpecialMappingKeys.MergeKey) {
            Object.assign(container, reduceMergeKeys(walkAST(mapping.value, options, duplicatedMappingKeys)));
          } else {
            container[mapping.key.value] = walkAST(mapping.value, options, duplicatedMappingKeys);
          }
        }

        return container;
      }
      case Kind.SEQ:
        return (node as YAMLSequence).items.map(item => walkAST(item, options, duplicatedMappingKeys));
      case Kind.SCALAR:
        return getScalarValue(node as YAMLScalar);
      case Kind.ANCHOR_REF:
        if (node.value !== void 0 && isCircularAnchorRef(node as YAMLAnchorReference)) {
          node.value = dereferenceAnchor(node.value, (node as YAMLAnchorReference).referencesAnchor);
        }

        return walkAST(node.value, options, duplicatedMappingKeys);
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

function getScalarValue(node: YAMLScalar): number | null | boolean | string | void {
  switch (determineScalarType(node)) {
    case ScalarType.null:
      return null;
    case ScalarType.string:
      return String(node.value);
    case ScalarType.bool:
      return parseYamlBoolean(node.value);
    case ScalarType.int:
      return parseYamlInteger(node.value);
    case ScalarType.float:
      return parseYamlFloat(node.value);
  }
}

// builds up the line map, for use by linesForPosition
const computeLineMap = (input: string) => {
  const lineMap: number[] = [];

  let i = 0;
  for (; i < input.length; i++) {
    if (input[i] === '\n') {
      lineMap.push(i + 1);
    }
  }

  lineMap.push(i + 1);

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

const reduceMergeKeys = (items: unknown): object | null => {
  if (Array.isArray(items)) {
    // reduceRight is on purpose here! We need to respect the order - the key cannot be overridden..
    return items.reduceRight((merged, item) => Object.assign(merged, item), {});
  }

  return typeof items !== 'object' || items === null ? null : Object(items);
};

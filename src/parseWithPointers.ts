import { DiagnosticSeverity, IDiagnostic, Optional } from '@stoplight/types';
import {
  determineScalarType,
  load as loadAST,
  parseYamlBoolean,
  parseYamlFloat,
  parseYamlInteger,
  YAMLException,
} from '@stoplight/yaml-ast-parser';
import { buildJsonPath } from './buildJsonPath';
import { SpecialMappingKeys } from './consts';
import { dereferenceAnchor } from './dereferenceAnchor';
import { lineForPosition } from './lineForPosition';
import { IParseOptions, Kind, ScalarType, YAMLMapping, YAMLNode, YamlParserResult, YAMLScalar } from './types';
import { isObject } from './utils';

export const parseWithPointers = <T>(value: string, options?: IParseOptions): YamlParserResult<T | undefined> => {
  const lineMap = computeLineMap(value);
  const ast = loadAST(value, {
    ...options,
    ignoreDuplicateKeys: true,
  }) as YAMLNode;

  const parsed: YamlParserResult<T | undefined> = {
    ast,
    lineMap,
    data: undefined,
    diagnostics: [],
    metadata: options,
  };

  if (!ast) return parsed;

  parsed.data = walkAST(ast, options, lineMap, parsed.diagnostics) as T;

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

const KEYS = Symbol('object_keys');

export const walkAST = (
  node: YAMLNode | null,
  options: Optional<IParseOptions>,
  lineMap: number[],
  diagnostics: IDiagnostic[],
): unknown => {
  if (node) {
    switch (node.kind) {
      case Kind.MAP: {
        const preserveKeyOrder = options !== void 0 && options.preserveKeyOrder === true;
        const container = createMapContainer(preserveKeyOrder);
        // note, we don't handle null aka '~' keys on purpose
        const seenKeys: string[] = [];
        const handleMergeKeys = options !== void 0 && options.mergeKeys === true;
        const yamlMode = options !== void 0 && options.json === false;
        const handleDuplicates = options !== void 0 && options.ignoreDuplicateKeys === false;

        for (const mapping of node.mappings) {
          if (!validateMappingKey(mapping, lineMap, diagnostics, yamlMode)) continue;

          const key = String(getScalarValue(mapping.key));

          if ((yamlMode || handleDuplicates) && (!handleMergeKeys || key !== SpecialMappingKeys.MergeKey)) {
            if (seenKeys.includes(key)) {
              if (yamlMode) {
                throw new Error('Duplicate YAML mapping key encountered');
              }

              if (handleDuplicates) {
                diagnostics.push(createYAMLException(mapping.key, lineMap, 'duplicate key'));
              }
            } else {
              seenKeys.push(key);
            }
          }

          // https://yaml.org/type/merge.html merge keys, not a part of YAML spec
          if (handleMergeKeys && key === SpecialMappingKeys.MergeKey) {
            const reduced = reduceMergeKeys(walkAST(mapping.value, options, lineMap, diagnostics), preserveKeyOrder);
            if (preserveKeyOrder && reduced !== null) {
              for (const reducedKey of Object.keys(reduced)) {
                pushKey(container, reducedKey);
              }
            }

            Object.assign(container, reduced);
          } else {
            container[key] = walkAST(mapping.value, options, lineMap, diagnostics);

            if (preserveKeyOrder) {
              pushKey(container, key);
            }
          }
        }

        if (KEYS in container) {
          (container as Partial<{ [KEYS]: Array<Symbol | string> }>)[KEYS]!.push(KEYS);
        }

        return container;
      }
      case Kind.SEQ:
        return node.items.map(item => walkAST(item, options, lineMap, diagnostics));
      case Kind.SCALAR:
        return getScalarValue(node);
      case Kind.ANCHOR_REF: {
        if (isObject(node.value)) {
          node.value = dereferenceAnchor(node.value, node.referencesAnchor)!;
        }

        return walkAST(node.value!, options, lineMap, diagnostics);
      }
      default:
        return null;
    }
  }

  return node;
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

const reduceMergeKeys = (items: unknown, preserveKeyOrder: boolean): object | null => {
  if (Array.isArray(items)) {
    // reduceRight is on purpose here! We need to respect the order - the key cannot be overridden
    const reduced = items.reduceRight(
      preserveKeyOrder
        ? (merged, item) => {
            const keys = Object.keys(item);
            for (let i = keys.length - 1; i >= 0; i--) {
              unshiftKey(merged, keys[i]);
            }

            return Object.assign(merged, item);
          }
        : (merged, item) => Object.assign(merged, item),
      createMapContainer(preserveKeyOrder),
    );

    if (preserveKeyOrder) {
      reduced[KEYS].push(KEYS);
    }

    return reduced;
  }

  return typeof items !== 'object' || items === null ? null : Object(items);
};

const traps = {
  ownKeys(target: object) {
    return target[KEYS];
  },
};

function createMapContainer(preserveKeyOrder: boolean): { [key in PropertyKey]: unknown } {
  if (preserveKeyOrder) {
    const container = new Proxy({}, traps);
    Reflect.defineProperty(container, KEYS, {
      value: [],
    });

    return container;
  }

  return {};
}

function deleteKey(container: object, key: string) {
  const index = key in container ? container[KEYS].indexOf(key) : -1;
  if (index !== -1) {
    container[KEYS].splice(index, 1);
  }
}

function unshiftKey(container: object, key: string) {
  deleteKey(container, key);
  container[KEYS].unshift(key);
}

function pushKey(container: object, key: string) {
  deleteKey(container, key);
  container[KEYS].push(key);
}

function validateMappingKey(
  mapping: YAMLMapping,
  lineMap: number[],
  diagnostics: IDiagnostic[],
  yamlMode: boolean,
): boolean {
  if (mapping.key.kind !== Kind.SCALAR) {
    if (!yamlMode) {
      diagnostics.push(
        createYAMLIncompatibilityException(mapping.key, lineMap, 'mapping key must be a string scalar', yamlMode),
      );
    }

    // no exception is thrown, yet the mapping is excluded regardless of mode, as we cannot represent the value anyway
    return false;
  }

  if (!yamlMode) {
    const type = typeof getScalarValue(mapping.key);
    if (type !== 'string') {
      diagnostics.push(
        createYAMLIncompatibilityException(
          mapping.key,
          lineMap,
          `mapping key must be a string scalar rather than ${mapping.key.valueObject === null ? 'null' : type}`,
          yamlMode,
        ),
      );
    }
  }

  return true;
}

function createYAMLIncompatibilityException(
  node: YAMLNode,
  lineMap: number[],
  message: string,
  yamlMode: boolean,
): IDiagnostic {
  const exception = createYAMLException(node, lineMap, message);
  exception.code = 'YAMLIncompatibleValue';
  exception.severity = yamlMode ? DiagnosticSeverity.Hint : DiagnosticSeverity.Warning;
  return exception;
}

function createYAMLException(node: YAMLNode, lineMap: number[], message: string): IDiagnostic {
  const startLine = lineForPosition(node.startPosition, lineMap);
  const endLine = lineForPosition(node.endPosition, lineMap);

  return {
    code: 'YAMLException',
    message,
    severity: DiagnosticSeverity.Error,
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
  };
}

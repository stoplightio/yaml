import createOrderedObject, { getOrder } from '@stoplight/ordered-object-literal';
import { DiagnosticSeverity, Dictionary, IDiagnostic, IPosition, IRange } from '@stoplight/types';
import {
  determineScalarType,
  load as loadAST,
  parseYamlBigInteger,
  parseYamlBoolean,
  parseYamlFloat,
  YAMLDocument,
  YAMLException,
} from '@stoplight/yaml-ast-parser';
import { buildJsonPath } from './buildJsonPath';
import { SpecialMappingKeys } from './consts';
import { dereferenceAnchor } from './dereferenceAnchor';
import { lineForPosition } from './lineForPosition';
import {
  IParseOptions,
  Kind,
  ScalarType,
  YamlComments,
  YAMLMapping,
  YAMLNode,
  YamlParserResult,
  YAMLScalar,
} from './types';
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
    comments: {},
  };

  if (!ast) return parsed;

  const normalizedOptions = normalizeOptions(options);

  const comments = new Comments(
    parsed.comments,
    Comments.mapComments(normalizedOptions.attachComments && ast.comments ? ast.comments : [], lineMap),
    ast,
    lineMap,
    '#',
  );

  const ctx = {
    lineMap,
    diagnostics: parsed.diagnostics,
  };

  parsed.data = walkAST(ctx, ast, comments, normalizedOptions) as T;

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

type WalkContext = {
  lineMap: number[];
  diagnostics: IDiagnostic[];
};

const TILDE_REGEXP = /~/g;
const SLASH_REGEXP = /\//g;

function encodeSegment(input: string) {
  return input.replace(TILDE_REGEXP, '~0').replace(SLASH_REGEXP, '~1');
}

const walkAST = (
  ctx: WalkContext,
  node: YAMLNode | null,
  comments: Comments,
  options: ReturnType<typeof normalizeOptions>,
): unknown => {
  if (node) {
    switch (node.kind) {
      case Kind.MAP: {
        const mapComments = comments.enter(node);

        const { lineMap, diagnostics } = ctx;
        const { preserveKeyOrder, ignoreDuplicateKeys, json, mergeKeys } = options;
        const container = createMapContainer(preserveKeyOrder);
        // note, we don't handle null aka '~' keys on purpose
        const seenKeys: string[] = [];
        const handleMergeKeys = mergeKeys;
        const yamlMode = !json;
        const handleDuplicates = !ignoreDuplicateKeys;

        for (const mapping of node.mappings) {
          if (!validateMappingKey(mapping, lineMap, diagnostics, yamlMode)) continue;

          const key = String(getScalarValue(mapping.key));
          const mappingComments = mapComments.enter(mapping, encodeSegment(key));

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
            const reduced = reduceMergeKeys(walkAST(ctx, mapping.value, mappingComments, options), preserveKeyOrder);

            Object.assign(container, reduced);
          } else {
            container[key] = walkAST(ctx, mapping.value, mappingComments, options);

            if (preserveKeyOrder) {
              pushKey(container, key);
            }
          }

          mappingComments.attachComments();
        }

        mapComments.attachComments();
        return container;
      }
      case Kind.SEQ: {
        const nodeComments = comments.enter(node);
        const container = node.items.map((item, i) => {
          if (item !== null) {
            const sequenceItemComments = nodeComments.enter(item, i);
            const walked = walkAST(ctx, item, sequenceItemComments, options);
            sequenceItemComments.attachComments();
            return walked;
          } else {
            return null;
          }
        });

        nodeComments.attachComments();
        return container;
      }
      case Kind.SCALAR: {
        const value = getScalarValue(node);
        return !options.bigInt && typeof value === 'bigint' ? Number(value) : value;
      }
      case Kind.ANCHOR_REF: {
        if (isObject(node.value)) {
          node.value = dereferenceAnchor(node.value, node.referencesAnchor)!;
        }

        return walkAST(ctx, node.value!, comments, options);
      }
      default:
        return null;
    }
  }

  return node;
};

function getScalarValue(node: YAMLScalar): number | bigint | null | boolean | string | void {
  switch (determineScalarType(node)) {
    case ScalarType.null:
      return null;
    case ScalarType.string:
      return String(node.value);
    case ScalarType.bool:
      return parseYamlBoolean(node.value);
    case ScalarType.int:
      return parseYamlBigInteger(node.value);
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
  let possiblyUnexpectedFlow = -1;
  let i = 0;

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

    const isBrokenFlow = error.reason === 'missed comma between flow collection entries';
    if (isBrokenFlow) {
      possiblyUnexpectedFlow = possiblyUnexpectedFlow === -1 ? i : possiblyUnexpectedFlow;
    } else if (possiblyUnexpectedFlow !== -1) {
      (validations[possiblyUnexpectedFlow].range as Dictionary<IPosition, keyof IRange>).end = validation.range.end;
      validations[possiblyUnexpectedFlow].message = 'invalid mixed usage of block and flow styles';
      validations.length = possiblyUnexpectedFlow + 1;
      i = validations.length;
      possiblyUnexpectedFlow = -1;
    }

    validations.push(validation);
    i++;
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

            Object.assign(merged, item);

            for (let i = keys.length - 1; i >= 0; i--) {
              unshiftKey(merged, keys[i]);
            }

            return merged;
          }
        : (merged, item) => Object.assign(merged, item),
      createMapContainer(preserveKeyOrder),
    );

    return reduced;
  }

  return typeof items !== 'object' || items === null ? null : Object(items);
};

function createMapContainer(preserveKeyOrder: boolean): { [key in PropertyKey]: unknown } {
  return preserveKeyOrder ? createOrderedObject({}) : {};
}

function deleteKey(container: Dictionary<unknown>, key: string) {
  if (!(key in container)) return;
  const order = getOrder(container)!;
  const index = order.indexOf(key);
  if (index !== -1) {
    order.splice(index, 1);
  }
}

function unshiftKey(container: Dictionary<unknown>, key: string) {
  deleteKey(container, key);
  getOrder(container)!.unshift(key);
}

function pushKey(container: Dictionary<unknown>, key: string) {
  deleteKey(container, key);
  getOrder(container)!.push(key);
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
  return {
    code: 'YAMLException',
    message,
    severity: DiagnosticSeverity.Error,
    path: buildJsonPath(node),
    range: getRange(lineMap, node.startPosition, node.endPosition),
  };
}

function getRange(lineMap: number[], startPosition: number, endPosition: number): IRange {
  const startLine = lineForPosition(startPosition, lineMap);
  const endLine = lineForPosition(endPosition, lineMap);

  return {
    start: {
      line: startLine,
      character: startLine === 0 ? startPosition : startPosition - lineMap[startLine - 1],
    },
    end: {
      line: endLine,
      character: endLine === 0 ? endPosition : endPosition - lineMap[endLine - 1],
    },
  };
}

type MappedComment = { value: string; range: IRange; startPosition: number; endPosition: number };
class Comments {
  private readonly comments: MappedComment[];

  constructor(
    private readonly attachedComments: YamlComments,
    comments: MappedComment[],
    private readonly node: YAMLNode,
    private readonly lineMap: number[],
    private readonly pointer: string,
  ) {
    if (comments.length === 0) {
      this.comments = [];
    } else {
      const startPosition = this.getStartPosition(node);
      const endPosition = this.getEndPosition(node);
      const startLine = lineForPosition(startPosition, this.lineMap);
      const endLine = lineForPosition(endPosition, this.lineMap);

      const matchingComments = [];
      for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        if (comment.range.start.line >= startLine && comment.range.end.line <= endLine) {
          matchingComments.push(comment);
          comments.splice(i, 1);
        }
      }

      this.comments = matchingComments;
    }
  }

  protected getStartPosition(node: YAMLNode) {
    if (node.parent === null) {
      return 0;
    }

    return node.kind === Kind.MAPPING ? node.key.startPosition : node.startPosition;
  }

  protected getEndPosition(node: YAMLNode): number {
    switch (node.kind) {
      case Kind.MAPPING:
        return node.value === null ? node.endPosition : this.getEndPosition(node.value);
      case Kind.MAP:
        return node.mappings.length === 0 ? node.endPosition : node.mappings[node.mappings.length - 1].endPosition;
      case Kind.SEQ: {
        if (node.items.length === 0) {
          return node.endPosition;
        }

        const lastItem = node.items[node.items.length - 1];
        return lastItem === null ? node.endPosition : lastItem.endPosition;
      }
      default:
        return node.endPosition;
    }
  }

  public static mapComments(comments: NonNullable<YAMLDocument['comments']>, lineMap: number[]) {
    return comments.map(comment => ({
      value: comment.value,
      range: getRange(lineMap, comment.startPosition, comment.endPosition),
      startPosition: comment.startPosition,
      endPosition: comment.endPosition,
    }));
  }

  public enter(node: YAMLNode, key?: string | number) {
    return new Comments(
      this.attachedComments,
      this.comments,
      node,
      this.lineMap,
      key === void 0 ? this.pointer : `${this.pointer}/${key}`,
    );
  }

  public static isLeading(node: YAMLNode, startPosition: number) {
    switch (node.kind) {
      case Kind.MAP:
        return node.mappings.length === 0 || node.mappings[0].startPosition > startPosition;
      case Kind.SEQ: {
        if (node.items.length === 0) {
          return true;
        }

        const firstItem = node.items[0];
        return firstItem === null || firstItem.startPosition > startPosition;
      }
      case Kind.MAPPING:
        return node.value === null || node.value.startPosition > startPosition;
      default:
        return false;
    }
  }

  public static isTrailing(node: YAMLNode, endPosition: number) {
    switch (node.kind) {
      case Kind.MAP:
        return node.mappings.length > 0 && endPosition > node.mappings[node.mappings.length - 1].endPosition;
      case Kind.SEQ:
        if (node.items.length === 0) {
          return false;
        }

        const lastItem = node.items[node.items.length - 1];
        return lastItem !== null && endPosition > lastItem.endPosition;
      case Kind.MAPPING:
        return node.value !== null && endPosition > node.value.endPosition;
      default:
        return false;
    }
  }

  public static findBetween(node: YAMLNode, startPosition: number, endPosition: number): [string, string] | null {
    switch (node.kind) {
      case Kind.MAP: {
        let left;
        for (const mapping of node.mappings) {
          if (startPosition > mapping.startPosition) {
            left = mapping.key.value;
          } else if (left !== void 0 && mapping.startPosition > endPosition) {
            return [left, mapping.key.value];
          }
        }

        return null;
      }
      case Kind.SEQ: {
        let left;
        for (let i = 0; i < node.items.length; i++) {
          const item = node.items[i];
          if (item === null) continue;
          if (startPosition > item.startPosition) {
            left = String(i);
          } else if (left !== void 0 && item.startPosition > endPosition) {
            return [left, String(i)];
          }
        }

        return null;
      }
      default:
        return null;
    }
  }

  public isBeforeEOL(comment: MappedComment) {
    return (
      this.node.kind === Kind.SCALAR ||
      (this.node.kind === Kind.MAPPING &&
        comment.range.end.line === lineForPosition(this.node.key.endPosition, this.lineMap))
    );
  }

  public attachComments() {
    if (this.comments.length === 0) return;

    const attachedComments = (this.attachedComments[this.pointer] = this.attachedComments[this.pointer] || []);

    for (const comment of this.comments) {
      if (this.isBeforeEOL(comment)) {
        attachedComments.push({
          value: comment.value,
          placement: 'before-eol',
        });
      } else if (Comments.isLeading(this.node, comment.startPosition)) {
        attachedComments.push({
          value: comment.value,
          placement: 'leading',
        });
      } else if (Comments.isTrailing(this.node, comment.endPosition)) {
        attachedComments.push({
          value: comment.value,
          placement: 'trailing',
        });
      } else {
        const between = Comments.findBetween(this.node, comment.startPosition, comment.endPosition);
        if (between !== null) {
          attachedComments.push({
            value: comment.value,
            placement: 'between',
            between,
          });
        } else {
          attachedComments.push({
            value: comment.value,
            placement: 'trailing',
          });
        }
      }
    }
  }
}

function normalizeOptions(options?: IParseOptions) {
  if (options === void 0) {
    return {
      attachComments: false,
      preserveKeyOrder: false,
      bigInt: false,
      mergeKeys: false,
      json: true,
      ignoreDuplicateKeys: false,
    };
  }

  return {
    ...options,
    attachComments: options.attachComments === true,
    preserveKeyOrder: options.preserveKeyOrder === true,
    bigInt: options.bigInt === true,
    mergeKeys: options.mergeKeys === true,
    json: options.json !== false,
    ignoreDuplicateKeys: options.ignoreDuplicateKeys !== false,
  };
}

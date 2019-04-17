import { DiagnosticSeverity } from '@stoplight/types';
import { parseWithPointers } from '../parseWithPointers';
import * as HugeJSON from './fixtures/huge-json.json';
import { HugeYAML } from './fixtures/huge-yaml';

const diverse = `---
  # <- yaml supports comments, json does not
  # did you know you can embed json in yaml?
  # try uncommenting the next line
  # { foo: 'bar' }

  json:
    - rigid
    - better for data interchange
  yaml:
    - slim and flexible
    - 123
    - true
  object:
    key: value
    array:
      - null_value:
      - boolean: true
      - integer: 1
  paragraph: >
      Blank lines denote

      paragraph breaks
  content: |-
      Or we
      can auto
      convert line breaks
      to save space`;

describe('yaml parser', () => {
  test.each(['test', 1])('parse scalar $s', val => {
    const result = parseWithPointers(String(val));
    expect(result.data).toEqual(val);
  });

  test('parse sequences', () => {
    const result = parseWithPointers('[0, 1, 2]');
    expect(result.data).toEqual([0, 1, 2]);
  });

  test('parse diverse', () => {
    const result = parseWithPointers(diverse);
    expect(result).toMatchSnapshot();
  });

  test('parse huge', () => {
    const result = parseWithPointers(HugeYAML);
    expect(result.data).toEqual(HugeJSON);
  });

  describe('report errors', () => {
    test('unknown tags', () => {
      const result = parseWithPointers(`function: !!js/function >
  function foobar() {
    return 'Wow! JS-YAML Rocks!';
  }
  
test: !!css >
  function boom() {}
`);

      expect(result).toHaveProperty('diagnostics', [
        {
          code: 'YAMLException',
          message: 'unknown tag <tag:yaml.org,2002:js/function>',
          range: {
            end: {
              character: 25,
              line: 0,
            },
            start: {
              character: 10,
              line: 0,
            },
          },
          severity: DiagnosticSeverity.Error,
        },
        {
          code: 'YAMLException',
          message: 'unknown tag <tag:yaml.org,2002:css>',
          range: {
            end: {
              character: 13,
              line: 5,
            },
            start: {
              character: 6,
              line: 5,
            },
          },
          severity: DiagnosticSeverity.Error,
        },
      ]);
    });

    test('invalid mapping', () => {
      const result = parseWithPointers(
        `prop1: true
prop2: true
  inner 1
  val: 2`
      );

      expect(result.diagnostics).toEqual([
        {
          severity: DiagnosticSeverity.Error,
          message: 'bad indentation of a mapping entry',
          code: 'YAMLException',
          range: {
            start: {
              character: 5,
              line: 3,
            },
            end: {
              character: 5,
              line: 3,
            },
          },
        },
        {
          severity: DiagnosticSeverity.Error,
          message: 'incomplete explicit mapping pair; a key node is missed',
          code: 'YAMLException',
          range: {
            start: {
              character: 7,
              line: 3,
            },
            end: {
              character: 7,
              line: 3,
            },
          },
        },
      ]);
    });
  });

  test('dereferences circular anchor refs', () => {
    const result = parseWithPointers(`definitions:
  model: &ref
    foo:
      name: *ref
`);
    expect(result.data).toEqual({
      definitions: {
        model: {
          foo: {
            name: {
              foo: {
                name: undefined,
              },
            },
          },
        },
      },
    });

    expect(() => JSON.stringify(result.data)).not.toThrow();
  });
});

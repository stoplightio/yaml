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
  test('parse diverse', () => {
    const result = parseWithPointers(diverse);
    expect(result).toMatchSnapshot();
  });

  test('parse huge', () => {
    const result = parseWithPointers(HugeYAML);
    expect(result.data).toEqual(HugeJSON);
  });

  test('report errors', () => {
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
            line: 2,
          },
          end: {
            character: 5,
            line: 2,
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
            line: 2,
          },
          end: {
            character: 7,
            line: 2,
          },
        },
      },
    ]);
  });
});

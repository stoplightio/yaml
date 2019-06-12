import { DiagnosticSeverity } from '@stoplight/types';
import * as fs from 'fs';
import * as path from 'path';
import { parseWithPointers } from '../parseWithPointers';
import * as HugeJSON from './fixtures/huge-json.json';
import { HugeYAML } from './fixtures/huge-yaml';

const diverse = fs.readFileSync(path.join(__dirname, './fixtures/diverse.yaml'), 'utf-8');

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

  describe('dereferencing anchor refs', () => {
    test('ignore valid refs', () => {
      const result = parseWithPointers(`austrian-cities: &austrian-cities
  - Vienna
  - Graz
  - Linz
  - Salzburg
  
european-cities:
  austria: *austrian-cities
`);
      expect(result.data).toEqual({
        'austrian-cities': ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        'european-cities': {
          austria: ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        },
      });
    });

    test('support circular refs in mapping', () => {
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

    test('support circular in refs sequences', () => {
      const result = parseWithPointers(`- &foo
  - test:
    - *foo
`);
      expect(result.data).toEqual([
        [
          {
            test: [[{ test: [undefined] }]],
          },
        ],
      ]);

      expect(() => JSON.stringify(result.data)).not.toThrow();
    });

    test('support mixed refs', () => {
      const result = parseWithPointers(`austrian-cities: &austrian-cities
  - Vienna
  - Graz
  - Linz
  - Salzburg
  
european-cities: &cities
    austria: *austrian-cities
    all: *cities
`);

      expect(result.data).toEqual({
        'austrian-cities': ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        'european-cities': {
          all: {
            austria: ['Vienna', 'Graz', 'Linz', 'Salzburg'],
          },
          austria: ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        },
      });

      expect(() => JSON.stringify(result.data)).not.toThrow();
    });

    test('support circular nested refs', () => {
      const result = parseWithPointers(`a: &foo
  - b: &bar
    - true
    - c: *bar
    - *foo
`);

      expect(result.data).toEqual({
        a: [
          {
            b: [true, { c: [true, { c: undefined }, undefined] }, [{ b: [true, { c: undefined }, undefined] }]],
          },
        ],
      });

      expect(() => JSON.stringify(result.data)).not.toThrow();
    });

    test('insane edge case', () => {
      const result = parseWithPointers(`- &foo
  - *foo
  - test:
    - *foo
  - abc: &test
      foo: 2
      a:
      c: *foo
      x: *test
`);
      expect(result.data).toMatchSnapshot();

      expect(() => JSON.stringify(result.data)).not.toThrow();
    });
  });
});

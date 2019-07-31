import { DiagnosticSeverity } from '@stoplight/types';
import * as fs from 'fs';
import * as path from 'path';
import { parseWithPointers } from '../parseWithPointers';
import * as HugeJSON from './fixtures/huge-json.json';
import { HugeYAML } from './fixtures/huge-yaml';

const diverse = fs.readFileSync(path.join(__dirname, './fixtures/diverse.yaml'), 'utf-8');
const duplicateMergeKeys = fs.readFileSync(path.join(__dirname, './fixtures/duplicate-merge-keys.yaml'), 'utf-8');

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

  describe('duplicate keys', () => {
    test('has JSON-ish approach to duplicate keys', () => {
      expect(parseWithPointers('foo: 0\nfoo: 1\n').data).toEqual({
        foo: 1,
      });
    });

    test('throws when duplicate key is encountered and not in JSON-ish mode', () => {
      expect(parseWithPointers.bind(null, 'foo: 0\nfoo: 1\n', { json: false })).toThrow(
        'Duplicate YAML mapping key encountered'
      );
    });

    test('reports duplicate keys', () => {
      expect(parseWithPointers('foo: 0\nfoo: 0\n', { ignoreDuplicateKeys: false })).toHaveProperty('diagnostics', [
        {
          code: 'YAMLException',
          message: 'duplicate key',
          path: ['foo'],
          range: {
            start: {
              line: 1,
              character: 0,
            },
            end: {
              line: 1,
              character: 3,
            },
          },
          severity: DiagnosticSeverity.Error,
        },
      ]);

      expect(
        parseWithPointers(
          `baz:
  duplicated: 2
  baz: 3
  duplicated: boo
  duplicated: 
    - yes
    - unfortunately, I am a dupe.
`,
          { ignoreDuplicateKeys: false }
        )
      ).toHaveProperty('diagnostics', [
        {
          code: 'YAMLException',
          message: 'duplicate key',
          path: ['baz', 'duplicated'],
          range: {
            start: {
              line: 3,
              character: 2,
            },
            end: {
              line: 3,
              character: 12,
            },
          },
          severity: DiagnosticSeverity.Error,
        },
        {
          code: 'YAMLException',
          message: 'duplicate key',
          path: ['baz', 'duplicated'],
          range: {
            start: {
              line: 4,
              character: 2,
            },
            end: {
              line: 4,
              character: 12,
            },
          },
          severity: DiagnosticSeverity.Error,
        },
      ]);
    });
  });

  describe('merge keys', () => {
    // http://blogs.perl.org/users/tinita/2019/05/reusing-data-with-yaml-anchors-aliases-and-merge-keys.html
    test('handles plain map value', () => {
      const result = parseWithPointers<any[]>(
        `---
- &CENTER { x: 1, y: 2 }
- &LEFT { x: 0, y: 2 }
- &BIG { r: 10 }
- &SMALL { r: 1 }

- # Merge one map
  << : *CENTER
  r: 10
  label: center/big`,
        { mergeKeys: true }
      );

      expect(result.data![4]).toEqual({
        x: 1,
        y: 2,
        r: 10,
        label: 'center/big',
      });
    });

    test('handles sequence of maps', () => {
      const result = parseWithPointers<any[]>(
        `---
- &CENTER { x: 1, y: 2 }
- &LEFT { x: 0, y: 2 }
- &BIG { r: 10 }
- &SMALL { r: 1 }

- # Merge multiple maps
  << : [ *CENTER, *BIG ]
  label: center/big`,
        { mergeKeys: true }
      );

      expect(result.data![4]).toEqual({
        x: 1,
        y: 2,
        r: 10,
        label: 'center/big',
      });
    });

    test('handles sequence of maps', () => {
      const result = parseWithPointers<any[]>(
        `---
- &CENTER { x: 1, y: 2 }
- &LEFT { x: 0, y: 2 }
- &BIG { r: 10 }
- &SMALL { r: 1 }

- # Merge multiple maps
  << : [ *CENTER, *BIG ]
  label: center/big`,
        { mergeKeys: true }
      );

      expect(result.data![4]).toEqual({
        x: 1,
        y: 2,
        r: 10,
        label: 'center/big',
      });
    });

    test('handles overrides', () => {
      const result = parseWithPointers<any[]>(
        `---
- &CENTER { x: 1, y: 2 }
- &LEFT { x: 0, y: 2 }
- &BIG { r: 10 }
- &SMALL { r: 1 }

- # Override
  << : [ *BIG, *LEFT, *SMALL ]
  x: 1
  label: center/big`,
        { mergeKeys: true }
      );

      expect(result.data![4]).toEqual({
        x: 1,
        y: 2,
        r: 10,
        label: 'center/big',
      });
    });

    test('handles duplicate merge keys', () => {
      const result = parseWithPointers(duplicateMergeKeys, { mergeKeys: true });

      // https://github.com/nodeca/js-yaml/blob/master/test/samples-common/duplicate-merge-key.js
      expect(result.data).toEqual({
        x: 1,
        y: 2,
        foo: 'bar',
        z: 3,
        t: 4,
      });
    });
  });
});

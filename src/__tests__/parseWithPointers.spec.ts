import { DiagnosticSeverity } from '@stoplight/types';
import * as fs from 'fs';
import * as path from 'path';
import { parseWithPointers } from '../parseWithPointers';
import * as HugeJSON from './fixtures/huge-json.json';
import { HugeYAML } from './fixtures/huge-yaml';

const diverse = fs.readFileSync(path.join(__dirname, './fixtures/diverse.yaml'), 'utf-8');
const duplicateMergeKeys = fs.readFileSync(path.join(__dirname, './fixtures/duplicate-merge-keys.yaml'), 'utf-8');
const mergeKeysWithDuplicateProperties = fs.readFileSync(
  path.join(__dirname, './fixtures/merge-keys-with-duplicate-props.yaml'),
  'utf-8',
);
const spectral481 = fs.readFileSync(path.join(__dirname, './fixtures/spectral-481.yaml'), 'utf-8');

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

  it('parses string according to YAML 1.2 spec', () => {
    const { data } = parseWithPointers(spectral481);
    expect(data).toHaveProperty(
      'components.schemas.RandomRequest.properties.implicit_string_date.example',
      '2012-10-12',
    );
    expect(data).toHaveProperty(
      'components.schemas.RandomRequest.properties.another_implicit_string_date.example',
      'x20121012',
    );
    expect(data).toHaveProperty(
      'components.schemas.RandomRequest.properties.explicit_string_date.example',
      '2012-10-12',
    );
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
  val: 2`,
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
                  name: null,
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
            test: [[{ test: [null] }]],
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

      expect(result.data).toStrictEqual({
        'austrian-cities': ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        'european-cities': {
          all: {
            all: null,
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

      expect(result.data).toStrictEqual({
        a: [
          {
            b: [true, { c: [true, { c: null }, null] }, [{ b: [true, { c: null }, null] }]],
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

    test('insane edge case #2', () => {
      const result = parseWithPointers(`&ref_1
a:
  b: &ref_2
    c:
      - *ref_1
  d:
    *ref_2
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
        'Duplicate YAML mapping key encountered',
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
          { ignoreDuplicateKeys: false },
        ),
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
        { mergeKeys: true },
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
        { mergeKeys: true },
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
        { mergeKeys: true },
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
        { mergeKeys: true },
      );

      expect(result.data![4]).toEqual({
        x: 1,
        y: 2,
        r: 10,
        label: 'center/big',
      });
    });

    test('handles overrides #2', () => {
      const result = parseWithPointers(mergeKeysWithDuplicateProperties, {
        mergeKeys: true,
        ignoreDuplicateKeys: false,
      });

      expect(result.data).toEqual({
        openapi: '3.0.0',
        'x-format-version': '1.0',
        info: {
          description: 'https://yaml.org/type/merge.html',
          title: 'Merge key issue',
          version: '1.0.0',
        },
        'x-center': {
          x: 1,
          y: 2,
        },
        'x-left': {
          x: 0,
          y: 2,
        },
        'x-big': {
          r: 10,
        },
        'x-small': {
          r: 1,
        },
        'x-one': {
          x: 1,
          y: 2,
          r: 10,
          label: 'center/big',
        },
        'x-two': {
          x: 1,
          y: 2,
          r: 10,
          label: 'center/big',
        },
        'x-three': {
          x: 1,
          y: 2,
          r: 10,
          label: 'center/big',
        },
        paths: {},
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

    test('does not report duplicate merge keys', () => {
      const result = parseWithPointers(duplicateMergeKeys, {
        mergeKeys: true,
        ignoreDuplicateKeys: false,
      });

      expect(result.diagnostics).toEqual([]);
    });

    test('does not report duplicate errors for merged keys', () => {
      const result = parseWithPointers(mergeKeysWithDuplicateProperties, {
        mergeKeys: true,
        ignoreDuplicateKeys: false,
      });

      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('invalid (not JSON-ish) mapping keys', () => {
    const complex = `[2]: test
{2:null}: false
2: test`;

    const responses = `responses:
  "200": {}
  400: {}
  true: false
  null: 2`;

    it('always excludes any complex types', () => {
      const { data: yamlData } = parseWithPointers(complex, { json: false });
      const { data: jsonData } = parseWithPointers(complex);

      expect(yamlData).toStrictEqual({
        '2': 'test',
      });

      expect(yamlData).toStrictEqual(jsonData);
    });

    it('always includes all scalar mapping keys', () => {
      const { data: yamlData } = parseWithPointers(responses, { json: false });
      const { data: jsonData } = parseWithPointers(responses);

      expect(yamlData).toStrictEqual({
        responses: {
          '200': {},
          '400': {},
          null: 2,
          true: false,
        },
      });

      expect(yamlData).toStrictEqual(jsonData);
    });

    it('warns about non-string scalar mapping keys', () => {
      const { diagnostics } = parseWithPointers(responses);

      expect(diagnostics).toEqual([
        {
          code: 'YAMLIncompatibleValue',
          message: 'mapping key must be a string scalar rather than number',
          path: ['responses', '400'],
          range: {
            end: {
              character: 5,
              line: 2,
            },
            start: {
              character: 2,
              line: 2,
            },
          },
          severity: DiagnosticSeverity.Warning,
        },
        {
          code: 'YAMLIncompatibleValue',
          message: 'mapping key must be a string scalar rather than boolean',
          path: ['responses', 'true'],
          range: {
            end: {
              character: 6,
              line: 3,
            },
            start: {
              character: 2,
              line: 3,
            },
          },
          severity: DiagnosticSeverity.Warning,
        },
        {
          code: 'YAMLIncompatibleValue',
          message: 'mapping key must be a string scalar rather than null',
          path: ['responses', 'null'],
          range: {
            end: {
              character: 6,
              line: 4,
            },
            start: {
              character: 2,
              line: 4,
            },
          },
          severity: DiagnosticSeverity.Warning,
        },
      ]);
    });

    it('warns about complex mapping keys', () => {
      const { diagnostics } = parseWithPointers(complex);

      expect(diagnostics).toEqual([
        {
          code: 'YAMLIncompatibleValue',
          message: 'mapping key must be a string scalar',
          path: [],
          range: {
            end: {
              character: 3,
              line: 0,
            },
            start: {
              character: 0,
              line: 0,
            },
          },
          severity: DiagnosticSeverity.Warning,
        },
        {
          code: 'YAMLIncompatibleValue',
          message: 'mapping key must be a string scalar',
          path: [],
          range: {
            end: {
              character: 8,
              line: 1,
            },
            start: {
              character: 0,
              line: 1,
            },
          },
          severity: DiagnosticSeverity.Warning,
        },
        {
          code: 'YAMLIncompatibleValue',
          message: 'mapping key must be a string scalar rather than number',
          path: ['2'],
          range: {
            end: {
              character: 1,
              line: 2,
            },
            start: {
              character: 0,
              line: 2,
            },
          },
          severity: DiagnosticSeverity.Warning,
        },
      ]);
    });

    describe('when json mode is disabled', () => {
      it('does not warn about non-string scalar mapping keys', () => {
        const { diagnostics } = parseWithPointers(responses, { json: false });

        expect(diagnostics).toEqual([]);
      });

      it('does not warn about complex mapping keys', () => {
        const { diagnostics } = parseWithPointers(complex, { json: false });

        expect(diagnostics).toStrictEqual([]);
      });
    });
  });

  describe('keys order', () => {
    it('does not retain the order of keys by default', () => {
      const { data } = parseWithPointers(`foo: true
bar: false
"1": false
"0": true
`);

      expect(Object.keys(data)).toEqual(['0', '1', 'foo', 'bar']);
    });

    describe('when preserveKeyOrder option is set to true', () => {
      it('retains the initial order of keys', () => {
        const { data } = parseWithPointers(
          `foo: true
bar: false
"1": false
"0": true
`,
          { preserveKeyOrder: true },
        );

        expect(Object.keys(data)).toEqual(['foo', 'bar', '1', '0']);
      });

      it('handles duplicate properties', () => {
        const { data } = parseWithPointers(
          `{
      foo: true,
      bar: false,
      "0": 0,
      foo: null,
      "1": false,
      "0": true,
      "1": 0,
    }`,
          { preserveKeyOrder: true },
        );

        expect(Object.keys(data)).toEqual(['bar', 'foo', '0', '1']);
        expect(data).toStrictEqual({
          bar: false,
          foo: null,
          1: 0,
          0: true,
        });
      });

      it('does not touch sequences', () => {
        const { data } = parseWithPointers(
          `- 0
- 1
- 2`,
          { preserveKeyOrder: true },
        );

        expect(Object.keys(data)).toEqual(['0', '1', '2']);
        expect(Object.getOwnPropertySymbols(data)).toEqual([]);
      });

      it('handles empty maps', () => {
        const { data } = parseWithPointers(`{}`, { preserveKeyOrder: true });

        expect(Object.keys(data)).toEqual([]);
      });

      it('works for nested maps', () => {
        const { data } = parseWithPointers(
          `foo:
  "1": "test"
  hello: 0,
  "0": false`,
          { preserveKeyOrder: true },
        );

        expect(Object.keys(data.foo)).toEqual(['1', 'hello', '0']);
      });
    });

    describe('merge keys handling', () => {
      it('treats merge keys as regular mappings by default', () => {
        const { data } = parseWithPointers(
          `---
- &CENTER { x: 1, y: 2 }
- &LEFT { x: 0, y: 2 }
- &BIG { r: 10 }
- &SMALL { r: 1 }
- 
  << : [ *BIG, *LEFT, *SMALL ]
  x: 1
  1: []
  0: true
  label: center/big`,
          { preserveKeyOrder: true },
        );

        expect(Object.keys(data[4])).toEqual(['<<', 'x', '1', '0', 'label']);
      });

      describe('when mergeKeys option is set to true', () => {
        it('takes mappings included as a result of merging into account', () => {
          const { data } = parseWithPointers(
            `---
- &CENTER { x: 1, y: 4 }
- &LEFT { x: 0, z: null, 1000: false, y: 2}
- &BIG { r: 10, 100: true }
- &SMALL { r: 1, 9: true }
- 
  << : [ *CENTER, *BIG, *LEFT, *SMALL ]
  x: 1
  1: []
  0: true
  label: center/big`,
            { preserveKeyOrder: true, mergeKeys: true },
          );

          expect(Object.keys(data[4])).toEqual(['y', 'r', '100', 'z', '1000', '9', 'x', '1', '0', 'label']);
        });
      });
    });
  });
});

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '../parse';

const diverse = fs.readFileSync(path.join(__dirname, './fixtures/diverse.yaml'), 'utf-8');

describe('parse', () => {
  test.each(['test', 1])('parse scalar $s', val => {
    const result = parse(String(val));
    expect(result).toEqual(val);
  });

  test('parse sequences', () => {
    const result = parse('[0, 1, 2]');
    expect(result).toEqual([0, 1, 2]);
  });

  test('parse diverse', () => {
    const result = parse(diverse);
    expect(result).toEqual({
      content: `Or we
can auto
convert line breaks
to save space`,
      json: ['rigid', 'better for data interchange'],
      object: {
        array: [
          {
            null_value: null,
          },
          {
            boolean: true,
          },
          {
            integer: 1,
          },
        ],
        key: 'value',
      },
      paragraph: 'Blank lines denote\nparagraph breaks\n',
      yaml: ['slim and flexible', 123, true],
    });
  });

  describe('dereferencing anchor refs', () => {
    test('ignore valid refs', () => {
      const result = parse(`austrian-cities: &austrian-cities
  - Vienna
  - Graz
  - Linz
  - Salzburg
  
european-cities:
  austria: *austrian-cities
`);
      expect(result).toEqual({
        'austrian-cities': ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        'european-cities': {
          austria: ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        },
      });
    });

    test('support circular refs in mapping', () => {
      const result = parse(`definitions:
  model: &ref
    foo:
      name: *ref
`);

      expect(result).toEqual({
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

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test('support circular in refs sequences', () => {
      const result = parse(`- &foo
  - test:
    - *foo
`);
      expect(result).toEqual([
        [
          {
            test: [[{ test: [undefined] }]],
          },
        ],
      ]);

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test('support mixed refs', () => {
      const result = parse(`austrian-cities: &austrian-cities
  - Vienna
  - Graz
  - Linz
  - Salzburg
  
european-cities: &cities
    austria: *austrian-cities
    all: *cities
`);

      expect(result).toEqual({
        'austrian-cities': ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        'european-cities': {
          all: {
            austria: ['Vienna', 'Graz', 'Linz', 'Salzburg'],
          },
          austria: ['Vienna', 'Graz', 'Linz', 'Salzburg'],
        },
      });

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test('support circular nested refs', () => {
      const result = parse(`a: &foo
  - b: &bar
    - true
    - c: *bar
    - *foo
`);

      expect(result).toEqual({
        a: [
          {
            b: [true, { c: [true, { c: undefined }, undefined] }, [{ b: [true, { c: undefined }, undefined] }]],
          },
        ],
      });

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test('insane edge case', () => {
      const result = parse(`- &foo
  - *foo
  - test:
    - *foo
  - abc: &test
      foo: 2
      a:
      c: *foo
      x: *test
`);
      expect(result).toMatchSnapshot();

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});

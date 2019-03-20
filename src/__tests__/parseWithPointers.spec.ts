import { DiagnosticSeverity } from '@stoplight/types';
import * as fs from 'fs';
import { join } from 'path';

import { lineForPosition, parseWithPointers } from '../parseWithPointers';
import * as HugeJSON from './fixtures/huge-json.json';
import { HugeYAML } from './fixtures/huge-yaml';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

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
  describe('lineForPosition', () => {
    test('simple fixture', () => {
      const lines = [13, 22, 36];
      // first line
      expect(lineForPosition(0, lines)).toEqual(0);

      expect(lineForPosition(12, lines)).toEqual(0);
      expect(lineForPosition(35, lines)).toEqual(2);

      // last line
      expect(lineForPosition(36, lines)).toEqual(3);
      expect(lineForPosition(39, lines)).toEqual(3);
    });

    test('diverse fixture', () => {
      const lines = [
        4,
        49,
        94,
        129,
        148,
        149,
        157,
        169,
        203,
        211,
        235,
        245,
        256,
        266,
        281,
        292,
        312,
        334,
        353,
        368,
        393,
        394,
        417,
        431,
        443,
        484,
      ];

      // first line
      expect(lineForPosition(0, lines)).toEqual(0);
      expect(lineForPosition(1, lines)).toEqual(0);
      expect(lineForPosition(4, lines)).toEqual(0);
      expect(lineForPosition(5, lines)).toEqual(1);
      expect(lineForPosition(51, lines)).toEqual(2);
      expect(lineForPosition(255, lines)).toEqual(12);
      expect(lineForPosition(256, lines)).toEqual(13);
      expect(lineForPosition(257, lines)).toEqual(13);
      expect(lineForPosition(417, lines)).toEqual(23);
      expect(lineForPosition(418, lines)).toEqual(23);
      expect(lineForPosition(483, lines)).toEqual(25);
      expect(lineForPosition(484, lines)).toEqual(26);
      expect(lineForPosition(599, lines)).toEqual(26);
    });
  });

  describe('getLocationForJsonPath', () => {
    describe('pet store fixture', () => {
      const { getLocationForJsonPath } = parseWithPointers(petStore);

      test.each`
        start       | end         | path
        ${[10, 11]} | ${[10, 29]} | ${['info', 'contact', 'email']}
        ${[30, 2]}  | ${[31, 9]}  | ${['schemes']}
      `('should return proper location for given JSONPath $path', ({ start, end, path }) => {
        expect(getLocationForJsonPath(path)).toEqual({
          range: {
            start: {
              character: start[1],
              line: start[0],
            },
            end: {
              character: end[1],
              line: end[0],
            },
          },
        });
      });
    });

    describe('simple fixture', () => {
      const { getLocationForJsonPath } = parseWithPointers(simple);

      test.each`
        start      | end        | path
        ${[0, 7]}  | ${[0, 12]} | ${['hello']}
        ${[2, 2]}  | ${[2, 13]} | ${['address']}
        ${[2, 10]} | ${[2, 13]} | ${['address', 'street']}
      `('should return proper location for given JSONPath $path', ({ start, end, path }) => {
        expect(getLocationForJsonPath(path)).toEqual({
          range: {
            start: {
              character: start[1],
              line: start[0],
            },
            end: {
              character: end[1],
              line: end[0],
            },
          },
        });
      });
    });
  });

  describe('simple fixture', () => {
    test('getJsonPathForPosition', () => {
      const { getJsonPathForPosition } = parseWithPointers(`hello: world
address:
  street: 123`);

      expect(
        getJsonPathForPosition({
          character: 4,
          line: 2,
        })
      ).toEqual(['address', 'street']);
      expect(
        getJsonPathForPosition({
          character: 3,
          line: 1,
        })
      ).toEqual(['address']);
      expect(
        getJsonPathForPosition({
          character: 4,
          line: 0,
        })
      ).toEqual(['hello']);
    });
  });

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

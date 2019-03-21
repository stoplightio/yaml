import * as fs from 'fs';
import { join } from 'path';
import { getLocationForJsonPath } from '../getLocationForJsonPath';
import { parseWithPointers } from '../parseWithPointers';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

describe('getLocationForJsonPath', () => {
  describe('pet store fixture', () => {
    const result = parseWithPointers(petStore);

    test.each`
      start       | end          | path
      ${[10, 11]} | ${[10, 29]}  | ${['info', 'contact', 'email']}
      ${[30, 2]}  | ${[31, 8]}   | ${['schemes']}
      ${[33, 2]}  | ${[104, 23]} | ${['paths']}
      ${[41, 8]}  | ${[42, 25]}  | ${['paths', '/pets', 'post', 'consumes']}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', 0]}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', '0']}
      ${[63, 10]} | ${[66, 26]}  | ${['paths', '/pets', 'get', 'responses', '200']}
    `('should return proper location for given JSONPath $path', ({ start, end, path }) => {
      expect(getLocationForJsonPath(result, path)).toEqual({
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
    const result = parseWithPointers(simple);

    test.each`
      start      | end        | path
      ${[0, 7]}  | ${[0, 12]} | ${['hello']}
      ${[2, 2]}  | ${[2, 13]} | ${['address']}
      ${[2, 10]} | ${[2, 13]} | ${['address', 'street']}
    `('should return proper location for given JSONPath $path', ({ start, end, path }) => {
      expect(getLocationForJsonPath(result, path)).toEqual({
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

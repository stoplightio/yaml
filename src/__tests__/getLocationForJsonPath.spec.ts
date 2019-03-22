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
      ${[9, 10]}  | ${[10, 29]}  | ${['info', 'contact']}
      ${[10, 11]} | ${[10, 29]}  | ${['info', 'contact', 'email']}
      ${[9, 10]}  | ${[10, 29]}  | ${['info', 'contact', 'dasdas']}
      ${[29, 8]}  | ${[31, 8]}   | ${['schemes']}
      ${[32, 6]}  | ${[104, 23]} | ${['paths']}
      ${[40, 15]} | ${[42, 25]}  | ${['paths', '/pets', 'post', 'consumes']}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', 0]}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', '0']}
      ${[60, 8]}  | ${[71, 60]}  | ${['paths', '/pets', 'get']}
      ${[62, 14]} | ${[66, 26]}  | ${['paths', '/pets', 'get', 'responses', '200']}
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
      ${[1, 8]}  | ${[2, 13]} | ${['address']}
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

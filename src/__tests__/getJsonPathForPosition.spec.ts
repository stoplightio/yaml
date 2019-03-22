import * as fs from 'fs';
import { join } from 'path';
import { getJsonPathForPosition } from '../getJsonPathForPosition';
import { parseWithPointers } from '../parseWithPointers';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

describe('getJsonPathForPosition', () => {
  describe('simple fixture', () => {
    const result = parseWithPointers(simple);

    test.each`
      line | character | path
      ${0} | ${0}      | ${['hello']}
      ${0} | ${13}     | ${undefined}
      ${0} | ${4}      | ${['hello']}
      ${1} | ${0}      | ${['address']}
      ${1} | ${12}     | ${['address']}
      ${2} | ${4}      | ${['address', 'street']}
    `('should return proper json path for line $line and character $character', ({ line, character, path }) => {
      expect(getJsonPathForPosition(result, { line, character })).toEqual(path);
    });
  });

  describe('petStore fixture', () => {
    const result = parseWithPointers(petStore);

    test.each`
      line  | character | path
      ${0}  | ${0}      | ${['swagger']}
      ${1}  | ${0}      | ${['info']}
      ${1}  | ${3}      | ${['info']}
      ${2}  | ${0}      | ${['info', 'title']}
      ${2}  | ${3}      | ${['info', 'title']}
      ${2}  | ${5}      | ${['info', 'title']}
      ${3}  | ${7}      | ${['info', 'version']}
      ${18} | ${25}     | ${['tags', 0, 'description']}
      ${30} | ${7}      | ${['schemes', 0]}
      ${31} | ${5}      | ${['schemes', 1]}
      ${40} | ${0}      | ${['paths', '/pets', 'post', 'consumes']}
      ${40} | ${3}      | ${['paths', '/pets', 'post', 'consumes']}
      ${41} | ${3}      | ${['paths', '/pets', 'post', 'consumes', 0]}
      ${42} | ${0}      | ${['paths', '/pets', 'post', 'consumes', 1]}
      ${42} | ${323}    | ${['paths', '/pets', 'post', 'consumes', 1]}
      ${62} | ${10}     | ${['paths', '/pets', 'get', 'responses', '200']}
    `('should return proper json path for line $line and character $character', ({ line, character, path }) => {
      expect(getJsonPathForPosition(result, { line, character })).toEqual(path);
    });
  });
});

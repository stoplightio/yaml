import * as fs from 'fs';
import { join } from 'path';
import { getJsonPathForPosition } from '../getJsonPathForPosition';
import { parseWithPointers } from '../parseWithPointers';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

const inline = `map:
  # Unordered set of key: value pairs.
  Block style: !!map
    Clark : Evans
    Ingy  : döt Net
    Oren  : Ben-Kiki
  Flow style: !!map { Clark: Evans, Ingy: döt Net, Oren: Ben-Kiki }`;

describe('getJsonPathForPosition', () => {
  describe('simple fixture', () => {
    const result = parseWithPointers(simple);

    test.each`
      line | character | path
      ${0} | ${0}      | ${['hello']}
      ${0} | ${13}     | ${undefined}
      ${0} | ${4}      | ${['hello']}
      ${1} | ${0}      | ${['address']}
      ${1} | ${7}      | ${['address']}
      ${1} | ${12}     | ${['address']}
      ${2} | ${4}      | ${['address', 'street']}
    `('should return proper json path for line $line and character $character', ({ line, character, path }) => {
      expect(getJsonPathForPosition(result, { line, character })).toEqual(path);
    });
  });

  describe('inline fixture', () => {
    const result = parseWithPointers(inline);

    test.each`
      line | character | path
      ${1} | ${0}      | ${['map', 'Block style']}
      ${6} | ${0}      | ${['map', 'Flow style']}
      ${6} | ${4}      | ${['map', 'Flow style']}
      ${6} | ${25}     | ${['map', 'Flow style', 'Clark']}
      ${6} | ${34}     | ${['map', 'Flow style', 'Clark']}
      ${6} | ${38}     | ${['map', 'Flow style', 'Ingy']}
      ${6} | ${51}     | ${['map', 'Flow style', 'Oren']}
      ${6} | ${52}     | ${['map', 'Flow style', 'Oren']}
      ${6} | ${57}     | ${['map', 'Flow style', 'Oren']}
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
      ${2}  | ${12}     | ${['info', 'title']}
      ${3}  | ${7}      | ${['info', 'version']}
      ${4}  | ${0}      | ${['info', 'description']}
      ${6}  | ${3}      | ${['info', 'description']}
      ${7}  | ${0}      | ${['info', 'description']}
      ${18} | ${25}     | ${['tags', 0, 'description']}
      ${27} | ${18}     | ${['tags', 2, 'externalDocs', 'description']}
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

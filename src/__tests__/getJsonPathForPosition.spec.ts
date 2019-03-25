import * as fs from 'fs';
import { join } from 'path';
import { getJsonPathForPosition } from '../getJsonPathForPosition';
import { parseWithPointers } from '../parseWithPointers';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const demo = fs.readFileSync(join(__dirname, './fixtures/demo.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

const emptyValues = `host: example.com
securityDefinitions: {}
paths: {}
parameters:
 skip:
    in: query
    type: string
    name: skip`;

describe('getJsonPathForPosition', () => {
  describe('emptyValues fixture', () => {
    const result = parseWithPointers(emptyValues);

    test.each`
      line | character | path
      ${2} | ${9}      | ${['paths']}
    `('should return proper json path for line $line and character $character', ({ line, character, path }) => {
      expect(getJsonPathForPosition(result, { line, character })).toEqual(path);
    });
  });

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

  describe('demo fixture', () => {
    const result = parseWithPointers(demo);

    test.each`
      line   | character | path
      ${8}   | ${0}      | ${['map', 'Block style']}
      ${8}   | ${19}     | ${['map', 'Block style']}
      ${12}  | ${0}      | ${['map', 'Flow style']}
      ${12}  | ${4}      | ${['map', 'Flow style']}
      ${12}  | ${25}     | ${['map', 'Flow style', 'Clark']}
      ${12}  | ${33}     | ${['map', 'Flow style', 'Clark']}
      ${12}  | ${38}     | ${['map', 'Flow style', 'Ingy']}
      ${12}  | ${51}     | ${['map', 'Flow style', 'Oren']}
      ${12}  | ${52}     | ${['map', 'Flow style', 'Oren']}
      ${12}  | ${57}     | ${['map', 'Flow style', 'Oren']}
      ${13}  | ${0}      | ${undefined}
      ${19}  | ${0}      | ${['omap', 'Bestiary', 0, 'aardvark']}
      ${19}  | ${10}     | ${['omap', 'Bestiary', 0, 'aardvark']}
      ${19}  | ${32}     | ${['omap', 'Bestiary', 0, 'aardvark']}
      ${42}  | ${0}      | ${['set', 'baseball players', 'Mark McGwire']}
      ${43}  | ${0}      | ${['set', 'baseball players', 'Sammy Sosa']}
      ${46}  | ${10}     | ${['set', 'baseball teams']}
      ${46}  | ${36}     | ${['set', 'baseball teams', 'Boston Red Sox']}
      ${46}  | ${42}     | ${['set', 'baseball teams', 'Detroit Tigers']}
      ${46}  | ${70}     | ${['set', 'baseball teams', 'New York Yankees']}
      ${46}  | ${75}     | ${['set', 'baseball teams']}
      ${50}  | ${0}      | ${['seq']}
      ${50}  | ${4}      | ${['seq']}
      ${55}  | ${0}      | ${['seq', 'Block style', 2]}
      ${55}  | ${12}     | ${['seq', 'Block style', 2]}
      ${61}  | ${3}      | ${['seq', 'Block style', 8]}
      ${61}  | ${40}     | ${['seq', 'Block style', 8]}
      ${62}  | ${3}      | ${['seq', 'Flow style']}
      ${62}  | ${28}     | ${['seq', 'Flow style', 0]}
      ${62}  | ${48}     | ${['seq', 'Flow style', 3]}
      ${62}  | ${49}     | ${['seq', 'Flow style']}
      ${62}  | ${64}     | ${['seq', 'Flow style']}
      ${63}  | ${29}     | ${['seq', 'Flow style', 4]}
      ${63}  | ${31}     | ${['seq', 'Flow style', 5]}
      ${63}  | ${42}     | ${['seq', 'Flow style', 6]}
      ${63}  | ${50}     | ${['seq', 'Flow style', 7]}
      ${66}  | ${0}      | ${undefined}
      ${138} | ${0}      | ${['null', '~']}
      ${202} | ${12}     | ${['foobar']}
      ${204} | ${7}      | ${['foobar', 1]}
      ${216} | ${12}     | ${['austrian-cities', 3]}
      ${220} | ${0}      | ${['cities', 'europe', 0]}
      ${228} | ${13}     | ${['cities', 'asia', 2]}
      ${234} | ${0}      | ${['european-cities', 'germany']}
      ${235} | ${0}      | ${['european-cities']}
      ${236} | ${0}      | ${['european-cities', 'austria']}
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

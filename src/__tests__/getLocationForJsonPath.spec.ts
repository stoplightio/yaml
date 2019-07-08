import * as fs from 'fs';
import { join } from 'path';
import { getLocationForJsonPath } from '../getLocationForJsonPath';
import { parseWithPointers } from '../parseWithPointers';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const spectral170 = fs.readFileSync(join(__dirname, './fixtures/spectral-170.yaml'), 'utf-8');
const spectralCRLF = fs.readFileSync(join(__dirname, './fixtures/spectral-crlf.yaml'), 'utf-8');
const spectralLF = fs.readFileSync(join(__dirname, './fixtures/spectral-lf.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

describe('getLocationForJsonPath', () => {
  describe('pet store fixture', () => {
    const result = parseWithPointers(petStore);

    test.each`
      start       | end          | path                                             | closest
      ${[9, 10]}  | ${[10, 29]}  | ${['info', 'contact']}                           | ${false}
      ${[10, 11]} | ${[10, 29]}  | ${['info', 'contact', 'email']}                  | ${false}
      ${[9, 10]}  | ${[10, 29]}  | ${['info', 'contact', 'dasdas']}                 | ${true}
      ${[]}       | ${[]}        | ${['info', 'contact', 'dasdas']}                 | ${false}
      ${[29, 8]}  | ${[31, 8]}   | ${['schemes']}                                   | ${false}
      ${[32, 6]}  | ${[104, 23]} | ${['paths']}                                     | ${false}
      ${[40, 15]} | ${[42, 25]}  | ${['paths', '/pets', 'post', 'consumes']}        | ${false}
      ${[40, 15]} | ${[42, 25]}  | ${['paths', '/pets', 'post', 'consumes', 5]}     | ${true}
      ${[]}       | ${[]}        | ${['paths', '/pets', 'post', 'consumes', 5]}     | ${false}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', 0]}     | ${false}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', 0, 1]}  | ${true}
      ${[]}       | ${[]}        | ${['paths', '/pets', 'post', 'consumes', 0, 1]}  | ${false}
      ${[41, 10]} | ${[41, 26]}  | ${['paths', '/pets', 'post', 'consumes', '0']}   | ${false}
      ${[60, 8]}  | ${[71, 60]}  | ${['paths', '/pets', 'get']}                     | ${false}
      ${[62, 14]} | ${[66, 26]}  | ${['paths', '/pets', 'get', 'responses', '200']} | ${false}
    `('should return proper location for given JSONPath $path', ({ start, end, path, closest }) => {
      expect(getLocationForJsonPath(result, path, closest)).toEqual(
        start.length > 0 && end.length > 0
          ? {
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
            }
          : void 0
      );
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

  describe('spectral bug #170 fixture', () => {
    const result = parseWithPointers(spectral170);

    test('should return proper location for empty mapping value', () => {
      expect(
        getLocationForJsonPath(result, ['definitions', 'AnotherDefinition', 'properties', 'special', 'description'])
      ).toEqual({
        range: {
          start: {
            character: 20,
            line: 35,
          },
          end: {
            character: 20,
            line: 35,
          },
        },
      });
    });
  });

  describe('CRLF fixture', () => {
    const resultCRLF = parseWithPointers(spectralCRLF);
    const resultLF = parseWithPointers(spectralLF);

    test.each`
      start     | end        | path                   | closest
      ${[0, 0]} | ${[5, 9]}  | ${['servers']}         | ${true}
      ${[2, 5]} | ${[4, 13]} | ${['info']}            | ${true}
      ${[2, 5]} | ${[4, 13]} | ${['info', 'server']}  | ${true}
      ${[2, 5]} | ${[4, 13]} | ${['info', 'contact']} | ${true}
      ${[4, 9]} | ${[4, 13]} | ${['info', 'title']}   | ${true}
      ${[5, 6]} | ${[5, 9]}  | ${['paths']}           | ${true}
    `('should return proper location for given JSONPath $path', ({ start, end, path, closest }) => {
      expect(getLocationForJsonPath(resultCRLF, path, closest)).toEqual(
        getLocationForJsonPath(resultLF, path, closest)
      );
      expect(getLocationForJsonPath(resultCRLF, path)).toEqual(getLocationForJsonPath(resultLF, path));
      expect(getLocationForJsonPath(resultCRLF, path, closest)).toEqual(
        start.length > 0 && end.length > 0
          ? {
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
            }
          : void 0
      );
    });
  });

  describe('shifted fixture', () => {
    const result = parseWithPointers(`--- foobar: bar`);

    test.each`
      start     | end        | path         | closest
      ${[0, 4]} | ${[0, 15]} | ${['paths']} | ${true}
    `('should return proper location for given JSONPath $path', ({ start, end, path, closest }) => {
      expect(getLocationForJsonPath(result, path, closest)).toEqual(
        start.length > 0 && end.length > 0
          ? {
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
            }
          : void 0
      );
    });
  });

  it('should handle null-ish items', () => {
    const result = parseWithPointers(`----~
foo: bar
`);

    expect(() => getLocationForJsonPath(result, ['foo'])).not.toThrow();
    expect(() => getLocationForJsonPath(result, ['bar'], true)).not.toThrow();
    expect(() => getLocationForJsonPath(result, ['null'], true)).not.toThrow();
  });
});

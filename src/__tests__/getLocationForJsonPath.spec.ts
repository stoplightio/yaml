import * as fs from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { getLocationForJsonPath } from '../getLocationForJsonPath';
import { parseWithPointers } from '../parseWithPointers';

const petStore = fs.readFileSync(join(__dirname, './fixtures/petstore.oas2.yaml'), 'utf-8');
const spectral170 = fs.readFileSync(join(__dirname, './fixtures/spectral-170.yaml'), 'utf-8');
const spectralCRLF = fs.readFileSync(join(__dirname, './fixtures/spectral-crlf.yaml'), 'utf-8');
const spectralLF = fs.readFileSync(join(__dirname, './fixtures/spectral-lf.yaml'), 'utf-8');
const spectralSpecMergeKeys = fs.readFileSync(join(__dirname, './fixtures/spectral-spec-merge-keys.yaml'), 'utf-8');
const duplicateMergeKeys = fs.readFileSync(join(__dirname, './fixtures/duplicate-merge-keys.yaml'), 'utf-8');
const simple = `hello: world
address:
  street: 123`;

describe('getLocationForJsonPath', () => {
  describe('pet store fixture', () => {
    const result = parseWithPointers(petStore);

    it.each`
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
          : void 0,
      );
    });
  });

  describe('simple fixture', () => {
    const result = parseWithPointers(simple);

    it.each`
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

  describe('merge keys fixture', () => {
    const result = parseWithPointers(spectralSpecMergeKeys, { mergeKeys: true });

    it.each`
      start       | end         | path
      ${[27, 23]} | ${[27, 39]} | ${['paths', '/pets', 'post', 'responses', 'default', 'description']}
      ${[28, 18]} | ${[31, 50]} | ${['paths', '/pets', 'post', 'responses', 'default', 'content']}
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

  describe('duplicate keys fixture', () => {
    const result = parseWithPointers(
      `foo: 2
foo: 4`,
    );

    it.each`
      start     | end       | path
      ${[1, 5]} | ${[1, 6]} | ${['foo']}
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

  describe('duplicate merge keys fixture', () => {
    const result = parseWithPointers(duplicateMergeKeys, { mergeKeys: true });

    it.each`
      start      | end        | path
      ${[2, 8]}  | ${[2, 9]}  | ${['x']}
      ${[2, 14]} | ${[2, 15]} | ${['y']}
      ${[3, 5]}  | ${[3, 8]}  | ${['foo']}
      ${[4, 8]}  | ${[4, 9]}  | ${['z']}
      ${[4, 14]} | ${[4, 15]} | ${['t']}
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

  describe('merge keys with overrides fixture', () => {
    const result = parseWithPointers(
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

    it.each`
      start      | end        | path
      ${[2, 19]} | ${[2, 20]} | ${[4, 'y']}
      ${[3, 12]} | ${[3, 14]} | ${[4, 'r']}
      ${[8, 5]}  | ${[8, 6]}  | ${[4, 'x']}
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

    it('should return proper location for empty mapping value', () => {
      expect(
        getLocationForJsonPath(result, ['definitions', 'AnotherDefinition', 'properties', 'special', 'description']),
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

    it.each`
      start     | end        | path                   | closest
      ${[0, 0]} | ${[5, 9]}  | ${['servers']}         | ${true}
      ${[2, 5]} | ${[4, 13]} | ${['info']}            | ${true}
      ${[2, 5]} | ${[4, 13]} | ${['info', 'server']}  | ${true}
      ${[2, 5]} | ${[4, 13]} | ${['info', 'contact']} | ${true}
      ${[4, 9]} | ${[4, 13]} | ${['info', 'title']}   | ${true}
      ${[5, 6]} | ${[5, 9]}  | ${['paths']}           | ${true}
    `('should return proper location for given JSONPath $path', ({ start, end, path, closest }) => {
      expect(getLocationForJsonPath(resultCRLF, path, closest)).toEqual(
        getLocationForJsonPath(resultLF, path, closest),
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
          : void 0,
      );
    });
  });

  describe('shifted fixture', () => {
    const result = parseWithPointers(`--- foobar: bar`);

    it.each`
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
          : void 0,
      );
    });
  });

  describe('sequence with null items', () => {
    const result = parseWithPointers(`-  
- foo
-
- bar
`);

    it.each`
      start     | end       | path      | closest
      ${[]}     | ${[]}     | ${[0]}    | ${false}
      ${[0, 0]} | ${[3, 5]} | ${[0]}    | ${true}
      ${[]}     | ${[]}     | ${[0, 1]} | ${false}
      ${[0, 0]} | ${[3, 5]} | ${[0, 1]} | ${true}
      ${[1, 2]} | ${[1, 5]} | ${[1]}    | ${false}
      ${[1, 2]} | ${[1, 5]} | ${[1]}    | ${true}
      ${[]}     | ${[]}     | ${[2]}    | ${false}
      ${[0, 0]} | ${[3, 5]} | ${[2]}    | ${true}
      ${[3, 2]} | ${[3, 5]} | ${[3]}    | ${false}
      ${[3, 2]} | ${[3, 5]} | ${[3]}    | ${true}
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
          : void 0,
      );
    });
  });

  describe('mappings with null values', () => {
    const result = parseWithPointers(`foo: ~
bar: null
baz:
`);

    it.each`
      start     | end       | path       | closest
      ${[0, 5]} | ${[0, 6]} | ${['foo']} | ${false}
      ${[0, 5]} | ${[0, 6]} | ${['foo']} | ${true}
      ${[1, 5]} | ${[1, 9]} | ${['bar']} | ${false}
      ${[1, 5]} | ${[1, 9]} | ${['bar']} | ${true}
      ${[2, 4]} | ${[2, 4]} | ${['baz']} | ${false}
      ${[2, 4]} | ${[2, 4]} | ${['baz']} | ${true}
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
          : void 0,
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

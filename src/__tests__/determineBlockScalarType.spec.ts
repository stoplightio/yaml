import { determineBlockScalarType } from '../determineBlockScalarType';
import { parseWithPointers } from '../parseWithPointers';

describe('determineBlockScalarType', () => {
  test('folded block scalar', () => {
    const result = parseWithPointers(`folded: >
  test
folded-with-clip-chomping-and-indentation: >2
  test

folded-with-strip-chomping-and-indentation: >-2
  test
folded-with-strip-chomping-and-indentation-reversed: >2-
  test
folded-with-strip-chomping: >-
  test
  
folded-with-keep-chomping-and-indentation: >+2
  test
folded-with-keep-chomping-and-indentation-reversed: >2+
  test
folded-with-keep-chomping: >+
  test
`);

    expect(determineBlockScalarType(result, ['folded'])).toEqual({
      style: 'folded',
      chomping: 'clip',
      indentation: null,
    });

    expect(determineBlockScalarType(result, ['folded-with-clip-chomping-and-indentation'])).toEqual({
      style: 'folded',
      chomping: 'clip',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['folded-with-strip-chomping-and-indentation-reversed'])).toEqual({
      style: 'folded',
      chomping: 'strip',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['folded-with-strip-chomping'])).toEqual({
      style: 'folded',
      chomping: 'strip',
      indentation: null,
    });

    expect(determineBlockScalarType(result, ['folded-with-keep-chomping-and-indentation'])).toEqual({
      style: 'folded',
      chomping: 'keep',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['folded-with-keep-chomping-and-indentation-reversed'])).toEqual({
      style: 'folded',
      chomping: 'keep',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['folded-with-keep-chomping'])).toEqual({
      style: 'folded',
      chomping: 'keep',
      indentation: null,
    });
  });

  test('literal block scalar', () => {
    const result = parseWithPointers(`literal: |
  test
literal-with-clip-chomping-and-indentation: |2
  test

literal-with-strip-chomping-and-indentation: |-2
  test
literal-with-strip-chomping-and-indentation-reversed: |2-
  test
literal-with-strip-chomping: |-
  test
  
literal-with-keep-chomping-and-indentation: |+2
  test
literal-with-keep-chomping-and-indentation-reversed: |2+
  test
literal-with-keep-chomping: |+
  test
`);

    expect(determineBlockScalarType(result, ['literal'])).toEqual({
      style: 'literal',
      chomping: 'clip',
      indentation: null,
    });

    expect(determineBlockScalarType(result, ['literal-with-clip-chomping-and-indentation'])).toEqual({
      style: 'literal',
      chomping: 'clip',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['literal-with-strip-chomping-and-indentation-reversed'])).toEqual({
      style: 'literal',
      chomping: 'strip',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['literal-with-strip-chomping'])).toEqual({
      style: 'literal',
      chomping: 'strip',
      indentation: null,
    });

    expect(determineBlockScalarType(result, ['literal-with-keep-chomping-and-indentation'])).toEqual({
      style: 'literal',
      chomping: 'keep',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['literal-with-keep-chomping-and-indentation-reversed'])).toEqual({
      style: 'literal',
      chomping: 'keep',
      indentation: '2',
    });

    expect(determineBlockScalarType(result, ['literal-with-keep-chomping'])).toEqual({
      style: 'literal',
      chomping: 'keep',
      indentation: null,
    });
  });

  test('invalid block scalar', () => {
    const result = parseWithPointers(`invalid-chomping: |++
  test
invalid-indentation: |20
  test
invalid-comment: |2#a
`);

    expect(determineBlockScalarType(result, ['invalid-chomping'])).toEqual({
      style: 'literal',
      chomping: 'clip',
      indentation: null,
    });

    expect(determineBlockScalarType(result, ['invalid-indentation'])).toEqual({
      style: 'literal',
      chomping: 'clip',
      indentation: null,
    });

    expect(determineBlockScalarType(result, ['invalid-comment'])).toEqual({
      style: 'literal',
      chomping: 'clip',
      indentation: '2',
    });
  });
});

import { parseWithPointers } from '../parseWithPointers';
import { computeRanges, RANGE } from '../insertRanges';

describe('insertRanges', () => {
  it('foo', () => {
    const parsed = parseWithPointers<any>(`foo: bar
baz:
  - addd`);

    expect(computeRanges(parsed)).toEqual({})
    expect(parsed.data.foo[RANGE]).toEqual({});
    expect(parsed.data.baz[RANGE]).toEqual({});
    expect(parsed.data.baz[0][RANGE]).toEqual({});
  })
});

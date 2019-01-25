/**
 * @jest-environment node
 */

import { safeStringify } from '../safeStringify';

describe('safeStringify', () => {
  it('should work', () => {
    const val = { foo: true };

    expect(safeStringify(val)).toEqual(`foo: true
`);
    expect(safeStringify('foo: true')).toEqual('foo: true');
  });
});

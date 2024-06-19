import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseWithPointers } from '../parseWithPointers';
import { safeStringify } from '../safeStringify';

describe('safeStringify', () => {
  it('should work', () => {
    const val = { foo: true };

    expect(safeStringify(val)).toEqual('foo: true\n');
  });

  it('should not stringify strings twice', () => {
    expect(safeStringify('foo: true')).toEqual('foo: true');
    expect(safeStringify('')).toEqual('');
  });

  it.each([0, null, false])('should stringify falsy value: %s', value => {
    expect(safeStringify(value)).toEqual(`${value}\n`);
  });

  it('should dump comments back', () => {
    const document = fs.readFileSync(path.join(__dirname, './fixtures/openapi-with-comments.yaml'), 'utf8');
    const result = parseWithPointers(document, { attachComments: true });

    expect(safeStringify(result.data, { comments: result.comments })).toEqual(document);
  });

  it('should respect lineWidth for multi-line strings', () => {
    const description = `# API information
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?`;

    expect(safeStringify({ description }, { lineWidth: 200 })).toEqual(`description: >-
  # API information

  Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae
  dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

  Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
  Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit
  esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?
`);
  });

  it('should use literal block-scalar style if lineWidth is Infinity (or very lengthy)', () => {
    const description = `# API information
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?`.trim();

    const val = { description };

    expect(safeStringify(val, { lineWidth: Infinity })).toEqual(`description: |-
${description
      .split('\n')
      .map(part => `  ${part}`)
      .join('\n')}
`);
  });

  it('should use anchors for same objects by default', () => {
    const obj = { foo: 'bar' };

    expect(safeStringify({ a: obj, b: obj })).toEqual(`a: &ref_0
  foo: bar
b: *ref_0
`);
  });

  it('should not use anchors for same objects if noRefs is truthy', () => {
    const obj = { foo: 'bar' };

    expect(safeStringify({ a: obj, b: obj }, { noRefs: true })).toEqual(`a:
  foo: bar
b:
  foo: bar
`);
  });

  it('should stringify strings containing numbers with leading 0 (but are not octals) correctly', () => {
    const obj = { value: '012345678' };

    expect(safeStringify(obj, { noRefs: true })).toEqual(`value: '012345678'\n`);
  });

  it('should correctly escape anchors', () => {
    const obj = { value: 'test' };

    expect(safeStringify([obj, obj])).toEqual(`- &ref_0
  value: test
- *ref_0
`);
  });

  it('should stringify big integers', () => {
    const obj = { value: BigInt('1267650600228229401496703205376') };

    expect(safeStringify(obj)).toEqual(`value: 1267650600228229401496703205376\n`);
  });
});

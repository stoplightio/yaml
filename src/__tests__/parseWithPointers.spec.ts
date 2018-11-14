import { lineForPosition, yamlParser } from '../parseWithPointers';
import * as HugeJSON from './fixtures/huge-json.json';
import { HugeYAML } from './fixtures/huge-yaml';

const diverse = `---
  # <- yaml supports comments, json does not
  # did you know you can embed json in yaml?
  # try uncommenting the next line
  # { foo: 'bar' }

  json:
    - rigid
    - better for data interchange
  yaml:
    - slim and flexible
    - 123
    - true
  object:
    key: value
    array:
      - null_value:
      - boolean: true
      - integer: 1
  paragraph: >
      Blank lines denote

      paragraph breaks
  content: |-
      Or we
      can auto
      convert line breaks
      to save space`;

describe('yaml parser', () => {
  test('lineForPosition simple', () => {
    const lines = [0, 13, 22, 36];
    // first line
    expect(lineForPosition(0, lines)).toEqual(1);

    expect(lineForPosition(12, lines)).toEqual(1);
    expect(lineForPosition(35, lines)).toEqual(3);

    // last line
    expect(lineForPosition(36, lines)).toEqual(4);
    expect(lineForPosition(39, lines)).toEqual(4);
  });

  test('lineForPosition diverse', () => {
    const lines = [
      0,
      4,
      49,
      94,
      129,
      148,
      149,
      157,
      169,
      203,
      211,
      235,
      245,
      256,
      266,
      281,
      292,
      312,
      334,
      353,
      368,
      393,
      394,
      417,
      431,
      443,
      484,
    ];

    // first line
    expect(lineForPosition(0, lines)).toEqual(1);
    expect(lineForPosition(1, lines)).toEqual(1);
    expect(lineForPosition(4, lines)).toEqual(2);
    expect(lineForPosition(5, lines)).toEqual(2);
    expect(lineForPosition(51, lines)).toEqual(3);
    expect(lineForPosition(255, lines)).toEqual(13);
    expect(lineForPosition(256, lines)).toEqual(14);
    expect(lineForPosition(257, lines)).toEqual(14);
    expect(lineForPosition(417, lines)).toEqual(24);
    expect(lineForPosition(418, lines)).toEqual(24);
    expect(lineForPosition(483, lines)).toEqual(26);
    expect(lineForPosition(484, lines)).toEqual(27);
    expect(lineForPosition(599, lines)).toEqual(27);
  });

  test('parse simple', () => {
    expect(
      yamlParser()(`hello: world
address:
  street: 123`)
    ).toMatchSnapshot();
  });

  test('parse diverse', () => {
    const result = yamlParser()(diverse);
    delete result.validations;
    expect(result).toMatchSnapshot();
  });

  test('parse huge', () => {
    const result = yamlParser()(HugeYAML);
    expect(result.data).toEqual(HugeJSON);
  });

  test('max depth option', () => {
    const result = yamlParser({ maxPointerDepth: 3 })(`prop1: true
prop2: true
prop3:
  prop3-1:
    prop3-1-1:
      prop3-1-1-1: true
    prop3-1-2:
      - one
      - two`);

    expect(result.pointers).toMatchSnapshot();
  });

  test('report errors', () => {
    const result = yamlParser({ maxPointerDepth: 3 })(`prop1: true
prop2: true
  inner 1
  val: 2`);

    expect(result.validations).toEqual([
      {
        level: 60,
        location: { start: { line: 3 } },
        msg: 'bad indentation of a mapping entry',
        ruleId: 'YAMLException',
      },
      {
        level: 60,
        location: { start: { line: 3 } },
        msg: 'incomplete explicit mapping pair; a key node is missed',
        ruleId: 'YAMLException',
      },
    ]);
  });
});

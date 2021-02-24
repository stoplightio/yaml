import { JsonPath, Optional } from '@stoplight/types';
import { findNodeAtPath } from './findNodeAtPath';
import { Kind, YamlParserResult } from './types';

export type BlockScalarStyle = 'folded' | 'literal';

// https://yaml.org/spec/1.2/spec.html#id2793652 8.1.1.2
export type BlockChomping = 'strip' | 'keep' | 'clip';

export type BlockScalarType = {
  /*
    [170]  c-l+literal(n)  ::=   “|” c-b-block-header(m,t)
                                  l-literal-content(n+m,t)

    [174]  c-l+folded(n)   ::=   “>” c-b-block-header(m,t)
                                  l-folded-content(n+m,t)
   */
  style: BlockScalarStyle;

  /*
    [164]  c-chomping-indicator(t)   ::=   “-”           ⇒ t = strip
                                           “+”           ⇒ t = keep
                                           /* Empty *\/  ⇒ t = clip
  */
  chomping: BlockChomping;
  // null if none provided, we do not do any detection **on purpose** as we want to get the _authored_ input
  /*
    [163]  c-indentation-indicator(m)  ::=   ns-dec-digit  ⇒ m  = ns-dec-digit - #x30
                                             /* Empty *\/  ⇒ m  = auto-detect() // this is the part we do not care about
  */
  indentation: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | null;
};

const LITERAL_BLOCK_STYLE_SIGN = '|';
const FOLDED_BLOCK_STYLE_SIGN = '>';

const STRIP_CHOMPING_SIGN = '-';
const KEEP_CHOMPING_SIGN = '+';
const C_CHOMPING_INDICATOR = /[-+]?/;

// https://yaml.org/spec/1.2/spec.html#ns-dec-digit
// const NS_DEC_DIGIT = /[0-9]/;
const C_INDENTATION_INDICATOR = /[1-9]?/; // 1 cause it's ns-dec-digit - #x30, so 0-9 without 0

/*
  [31]  s-space   ::=   #x20 /* SP *\/
  [32]  s-tab     ::=   #x9  /* TAB *\/
  [33]  s-white   ::=   s-space | s-tab
*/
// const S_SPACE_SIGN = /\u0020/;
// const S_TAB = /\u0009/;
const S_WHITE = /^[\u0020\u0009]$/;

/*
  [24]  b-line-feed         ::=   #xA    /* LF *\/
  [25]  b-carriage-return   ::=   #xD    /* CR *\/
  [26]  b-char              ::=   b-line-feed | b-carriage-return
*/
// const B_LINE_FEED_SIGN = /\u000A/;
// const B_CARRIAGE_RETURN_SIGN = /\u000D/;
const B_CHAR = /^[\u000A\u000D]$/;

// https://yaml.org/spec/1.2/spec.html#id2793652
export const determineBlockScalarType = (
  { ast, metadata }: YamlParserResult<unknown>,
  path: JsonPath,
): Optional<BlockScalarType> => {
  const node = findNodeAtPath(ast, path, {
    closest: false,
    mergeKeys: metadata !== void 0 && metadata.mergeKeys === true,
  });

  if (node === void 0 || node.kind !== Kind.SCALAR || typeof node.value !== 'string') return;

  const { rawValue } = node;
  if (rawValue.length === 0) return;

  const style: Optional<BlockScalarStyle> =
    rawValue[0] === FOLDED_BLOCK_STYLE_SIGN ? 'folded' : rawValue[0] === LITERAL_BLOCK_STYLE_SIGN ? 'literal' : void 0;

  if (style === void 0) {
    return;
  }

  return {
    style,
    ...getBlockHeader(rawValue),
  };
};

/*
  [162]  c-b-block-header(m,t)   ::=   ( ( c-indentation-indicator(m)
                                           c-chomping-indicator(t) )
                                       | ( c-chomping-indicator(t)
                                           c-indentation-indicator(m) ) )
                                       s-b-comment
 */
const C_B_BLOCK_HEADER = new RegExp( // we ignore s-b-comment
  [
    `^(?:(?<indentation>${C_INDENTATION_INDICATOR.source})(?<chomping>${C_CHOMPING_INDICATOR.source}))$`,
    `^(?:(?<chomping2>${C_CHOMPING_INDICATOR.source})(?<indentation2>${C_INDENTATION_INDICATOR.source}))$`,
  ].join('|'),
);

function getBlockHeader(value: string): Pick<BlockScalarType, 'indentation' | 'chomping'> {
  let n = -1;
  const max = Math.min(value.length, 3);
  while (n++ < max) {
    if (B_CHAR.test(value[n]) || S_WHITE.test(value[n])) {
      break;
    }
  }

  const result = C_B_BLOCK_HEADER.exec(value.slice(1, n));

  if (result === null) {
    return {
      indentation: null,
      chomping: 'clip',
    };
  }

  const groups = result.groups!;
  const indentation = (groups.indentation || groups.indentation2 || null) as BlockScalarType['indentation'];
  const chomping = groups.chomping || groups.chomping2;
  return {
    indentation,
    chomping: chomping === STRIP_CHOMPING_SIGN ? 'strip' : chomping === KEEP_CHOMPING_SIGN ? 'keep' : 'clip',
  };
}

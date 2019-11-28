import { Dictionary, ILocation, JsonPath, Optional } from '@stoplight/types';
import { findNodeAtPath, getLocationForJsonPath } from './getLocationForJsonPath';
import { YamlParserResult } from './types';
import { isObject } from './utils';

function compactRange(location: Optional<ILocation>): Optional<[number, number, number, number]> {
  if (location === void 0) return location;

  return [
    location.range.start.line,
    location.range.start.character,
    location.range.end.line,
    location.range.end.character,
  ];
}

function _computeRanges(
  parsed: YamlParserResult<unknown>,
  path: JsonPath,
  pointers: Dictionary<Optional<[number, number, number, number]>>,
) {
  const { ast, data } = parsed;

  pointers[`#${path.join('/')}`] = compactRange(getLocationForJsonPath(parsed, [], true));

  if (!isObject(data)) return;

  const len = path.push('');
  for (const key in data) {
    if (!Object.hasOwnProperty.call(data, key)) continue;
    path.length = len;
    path[len - 1] = key;

    const node = findNodeAtPath(ast, [key], {
      closest: true,
      mergeKeys: parsed.metadata !== void 0 && parsed.metadata.mergeKeys === true,
    });

    if (node === void 0) continue;

    parsed.ast = node;
    parsed.data = data[key];

    _computeRanges(parsed, path, pointers);
  }
}

export const computeRanges = (parsed: YamlParserResult<unknown>) => {
  const pointers = {};
  _computeRanges(parsed, [''], pointers);
  return pointers;
};

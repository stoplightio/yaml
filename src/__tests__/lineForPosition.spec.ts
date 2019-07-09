import { lineForPosition } from '../lineForPosition';

describe('lineForPosition', () => {
  test('simple fixture', () => {
    const lines = [13, 22, 36];
    // first line
    expect(lineForPosition(0, lines)).toEqual(0);

    expect(lineForPosition(12, lines)).toEqual(0);
    expect(lineForPosition(13, lines)).toEqual(1);
    expect(lineForPosition(35, lines)).toEqual(2);

    // last line
    expect(lineForPosition(36, lines)).toEqual(3);
    expect(lineForPosition(39, lines)).toEqual(3);
  });

  test('diverse fixture', () => {
    const lines = [
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
    expect(lineForPosition(0, lines)).toEqual(0);
    expect(lineForPosition(1, lines)).toEqual(0);
    expect(lineForPosition(4, lines)).toEqual(1);
    expect(lineForPosition(5, lines)).toEqual(1);
    expect(lineForPosition(51, lines)).toEqual(2);
    expect(lineForPosition(255, lines)).toEqual(12);
    expect(lineForPosition(256, lines)).toEqual(13);
    expect(lineForPosition(257, lines)).toEqual(13);
    expect(lineForPosition(417, lines)).toEqual(23);
    expect(lineForPosition(418, lines)).toEqual(23);
    expect(lineForPosition(483, lines)).toEqual(25);
    expect(lineForPosition(484, lines)).toEqual(26);
    expect(lineForPosition(599, lines)).toEqual(26);
  });
});

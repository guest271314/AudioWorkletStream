// https://stackoverflow.com/a/35248852
export default function int16ToFloat32(uint16, channels) {
  for (let i = 0, j = 0, n = 1; i < uint16.length; i++) {
    const int = uint16[i];
    // If the high bit is on, then it is a negative number, and actually counts backwards.
    const float = int >= 0x8000 ? -(0x10000 - int) / 0x8000 : int / 0x7fff;
    // interleave
    channels[(n = ++n % 2)][!n ? j++ : j - 1] = float;
  }
}

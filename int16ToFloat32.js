// https://stackoverflow.com/a/35248852
export default function int16ToFloat32(inputArray) {
    let ch0 = [];
    let ch1 = [];
    for (let i = 0; i < inputArray.length; i++) {
      const int = inputArray[i];
      // If the high bit is on, then it is a negative number, and actually counts backwards.
      const float = (int >= 0x8000) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
      // toggle setting data to channels 0, 1
      if (i % 2 === 0) {
        ch0.push(float);
      } else {
        ch1.push(float);
      }
    };
    return {
      ch0, ch1
    };
  }
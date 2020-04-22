// https://bugzilla.mozilla.org/show_bug.cgi?id=1247687
// import {CODECS} from './codecs.js';
function int16ToFloat32(inputArray) {
  let ch0 = [];
  let ch1 = [];
  for (let i = 0; i < inputArray.length; i++) {
    const int = inputArray[i];
    // If the high bit is on, then it is a negative number, and actually counts backwards.
    const float = int >= 0x8000 ? -(0x10000 - int) / 0x8000 : int / 0x7fff;
    // toggle setting data to channels 0, 1
    if (i % 2 === 0) {
      ch0.push(float);
    } else {
      ch1.push(float);
    }
  }
  return {
    ch0,
    ch1,
  };
}
let port, processStream;
let init = false;
async function* stream(urls) {
  while (urls.length) {
    yield (await fetch(urls.shift())).body;
  }
}
async function* process(reader) {
  let next = [];
  let overflow = [[], []];
  while (true) {
    let { value, done } = await reader.read();
    if (done) {
      console.log('readable close', next.length, overflow.length);
      // handle overflow floats < 128 length
      if (overflow[0].length || overflow[1].length) {
        const channel0 = new Float32Array(overflow.splice(0, 1)[0]);
        const channel1 = new Float32Array(overflow.splice(0, 1)[0]);
        port.postMessage(
          {
            channel0,
            channel1,
          },
          [channel0.buffer, channel1.buffer]
        );
      }
      return await reader.closed;
    }
    // value (Uint8Array) length is not guaranteed to be multiple of 2 for Uint16Array
    // store remainder of value in next array
    if (value.length % 2 !== 0 && next.length === 0) {
      next.push(...value.slice(value.length - 1));
      value = value.slice(0, value.length - 1);
    } else {
      const prev = [...next.splice(0, next.length), ...value];
      while (prev.length % 2 !== 0) {
        next.push(...prev.splice(-1));
      }
      value = new Uint8Array(prev);
    }
    // we do not need length here, we process input until no more, or infinity
    let data = new Uint16Array(value.buffer);
    if (!init) {
      init = true;
      data = data.subarray(22);
    }
    let { ch0, ch1 } = int16ToFloat32(data);
    // send  128 sample frames to process()
    // to reduce, not entirely avoid, glitches
    sample: while (ch0.length && ch1.length) {
      let __ch0, __ch1;
      // last splice() not guaranteed to be length 128
      let _ch0 = ch0.splice(0, 128);
      let _ch1 = ch1.splice(0, 128);
      let [overflow0, overflow1] = overflow;
      if (_ch0.length < 128 || _ch1.length < 128) {
        overflow0.push(..._ch0);
        overflow1.push(..._ch1);
        break sample;
      }
      if (overflow0.length || overflow1.length) {
        __ch0 = overflow0.splice(0, overflow0.length);
        __ch1 = overflow1.splice(0, overflow1.length);
        while (__ch0.length < 128 && _ch0.length) {
          let [float] = _ch0.splice(0, 1);
          __ch0.push(float);
        }
        while (__ch1.length < 128 && _ch1.length) {
          let [float] = _ch1.splice(0, 1);
          __ch1.push(float);
        }
      }
      const channel0 = new Float32Array(__ch0 || _ch0);
      const channel1 = new Float32Array(__ch1 || _ch1);
      port.postMessage({ channel0, channel1 }, [
        channel0.buffer,
        channel1.buffer,
      ]);
    }
    yield;
  }
}
onmessage = async e => {
  'use strict';
  if (!port) {
    ([port] = e.ports);
    port.onmessage = event => postMessage(event.data);
  }
  const { urls, codec } = e.data;
  // processStream = CODECS.get(codec);
  for await (const readable of stream(urls)) {
    for await (const _ of process(readable.getReader()));
  }
};

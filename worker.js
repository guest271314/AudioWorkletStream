// AudioWorkletStream 
// Stream audio from Worker to AudioWorklet (POC)
// guest271314 2-24-2020
import {
  CODECS
} from "./codecs.js";
if (gc) gc();
let port;
const delay = async ms => new Promise(resolve => setTimeout(resolve, ms));
onmessage = async e => {
  "use strict";
  if (!port) {
    ([port] = e.ports);
    port.onmessage = event => postMessage(event.data);
  }
  let init = false;
  const {
    codecs: [mimeCodec],
    urls: [url]
  } = e.data;
  const {
    default: processStream
  } = await import (CODECS.get(mimeCodec));
  let next = [];
  let writes = 0;
  let bytesWritten = 0;
  let samplesLength = 0;
  let portTransfers = 0;
  const response = await fetch(url);
  const readable = response.body;
  const writable = new WritableStream({
    async write(value) {
      bytesWritten += value.length;
      // value (Uintt8Array) length is not guaranteed to be multiple of 2 for Uint16Array
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
      const {
        ch0, ch1
      } = processStream(data);
      do {
        const channel0 = new Float32Array(ch0.splice(0, 128));
        const channel1 = new Float32Array(ch1.splice(0, 128));
        samplesLength += channel0.length + channel1.length;
        port.postMessage({
          channel0, channel1
        }, [channel0.buffer, channel1.buffer]);
        ++portTransfers;
      } while (ch0.length && ch1.length);
      ++writes;
      await delay(25);
    }, close() {
      globalThis.console.log({
        writes, bytesWritten, samplesLength, portTransfers
      });
      if (gc) gc();
    }
  }, new CountQueuingStrategy({
    highWaterMark: 128
  }));
  await readable.pipeTo(writable, {
    preventCancel: true
  });
  globalThis.console.log("read/write done");
}
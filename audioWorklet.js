import { CODECS } from './codecs.js';
class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    Object.assign(this, options.processorOptions, {
      uint8: new Uint8Array(290689440 - 44),
    });
    globalThis.console.log(currentTime, currentFrame, this.index, this.offset);
    this.port.onmessage = this.appendBuffers.bind(this);
  }
  async appendBuffers({ data: value }) {
    for (let i = !this.index ? 44 : 0; i < value.length; i++) {
      this.uint8[this.index++] = value[i];
      // accumulate 344 * 512 * 1.5 of data
      // to avoid glitches at beginning of playback
      // maintain this.index > this.offset
      // to avoid gaps during playback
      if (this.index === 344 * 512 * 1.5) {
        this.port.postMessage({ start: true });
      }
    }
  }
  endOfStream() {
    this.port.postMessage({
      ended: true,
      currentTime,
      currentFrame,
    });
  }
  process(inputs, outputs) {
    if (this.offset === this.uint8.length) {
      this.endOfStream();
      return false;
    }
    const channels = outputs.flat();
    const uint8 = new Uint8Array(512);
    for (let i = 0; i < 512; i++, this.offset++) {
      if (this.offset === this.uint8.length) {
        console.log(this.uint8);
        break;
      }
      uint8[i] = this.uint8[this.offset];
    }
    const uint16 = new Uint16Array(uint8.buffer);
    CODECS.get(this.codec)(uint16, channels);
    return true;
  }
}
registerProcessor('audio-data-worklet-stream', AudioDataWorkletStream);

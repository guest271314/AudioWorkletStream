import { CODECS } from './codecs.js';
class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    Object.assign(this, options.processorOptions, {
      uint8: new Uint8Array(290689440 - 44),
    });
    this.port.onmessage = this.appendBuffers.bind(this);
  }
  async appendBuffers({ data: { readable } }) {
    globalThis.console.log(currentTime, currentFrame);
    let index = 0;
    const reader = readable.getReader();
    const stream = async ({ value, done }) => {
      if (done) {
        await reader.closed;
        return 'read/write done';
      }
      for (let i = !index ? 44 : 0; i < value.length; i++) {
        this.uint8[index++] = value[i];
        // accumulate approximately one half second of data
        // to avoid glitches at beginning of playback
        if (index === ((344 / 2) * 512) / 2) {
          this.port.postMessage({ start: true });
        }
      }
      return stream(await reader.read());
    };
    const processStream = await stream(await reader.read());
    console.log(processStream, currentTime, currentFrame);
    Object.assign(this, { readable });
  }
  endOfStream() {
    this.port.postMessage({
      ended: true,
      currentTime,
      currentFrame,
    });
  }
  process(inputs, outputs) {
    const channels = outputs.flat();
    const uint8 = new Uint8Array(512);
    for (let i = 0; i < 512; i++, this.offset++) {
      if (this.offset === this.uint8.length) {
        this.port.postMessage({ ended: true, currentTime, currentFrame });
        return false;
      }
      uint8[i] = this.uint8[this.offset];
    }
    const uint16 = new Uint16Array(uint8.buffer);
    CODECS.get(this.codec)(uint16, channels);
    return true;
  }
}
registerProcessor('audio-data-worklet-stream', AudioDataWorkletStream);

import { CODECS } from './codecs.js';
class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    if (options.processorOptions) {
      Object.assign(this, options.processorOptions);
    }
    this.port.onmessage = this.appendBuffers.bind(this);
  }
  async appendBuffers({ data: { readable } }) {
    const processStream = CODECS.get(this.codec);
    // >= 64 to avoid TypeError:
    // Cannot destructure property 'channel0'
    // of 'this.buffers.get(...)' as it is undefined.
    // within process()
    const minSamples = 64;
    let next = [];
    let overflow = [[], []];
    let init = false;
    globalThis.console.log(currentTime, currentFrame, this.buffers.size);
    const strategy = new ByteLengthQueuingStrategy({
      highWaterMark: 32 * 1024
    });
    const source = {
      write: value => {
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
        let { ch0, ch1 } = processStream(data);
        // send  128 sample frames to process()
        // to reduce, not entirely avoid, glitches
        while (ch0.length && ch1.length) {
          let __ch0, __ch1;
          // last splice() not guaranteed to be length 128
          let _ch0 = ch0.splice(0, 128);
          let _ch1 = ch1.splice(0, 128);
          let [overflow0, overflow1] = overflow;
          if (_ch0.length < 128 || _ch1.length < 128) {
            overflow0.push(..._ch0);
            overflow1.push(..._ch1);
            break;
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
          this.buffers.set(this.i, {
            channel0,
            channel1,
          });
          ++this.i;
          if (this.i === minSamples) {
            console.log('this.buffers.size:' + this.buffers.size);
            this.port.postMessage({
              start: true,
            });
          }
        }
      },
      close: _ => {
        console.log('writable close', currentTime, currentFrame, this.buffers.size, next.length, overflow.length);
        // handle overflow floats < 128 length
        if (overflow[0].length || overflow[1].length) {
          const channel0 = new Float32Array(overflow.splice(0, 1)[0]);
          const channel1 = new Float32Array(overflow.splice(0, 1)[0]);
          this.buffers.set(this.i, {
            channel0,
            channel1,
          });
          ++this.i;
        }
      },
    };
    const writable = new WritableStream(source, strategy);
    Object.assign(this, { readable, writable });
    await readable.pipeTo(writable, {
      preventCancel: true,
    });
    console.log('read/write done', currentTime, currentFrame, this.buffers.size, next.length, overflow.length);

  }
  endOfStream() {
    this.port.postMessage({
      ended: true,
      currentTime,
      currentFrame,
    });
  }
  process(inputs, outputs) {
    if (!this.processStarted) {
      this.processStarted = true;
      console.log(
        'process() first call',
          currentTime,
          this.buffers.size
      );
    }
    if (currentTime > 0.9 && this.buffers.size === 0 && this.n === this.i) {
      console.log(
        this.i,
        this.n,
        this.buffers.size,
        this.readable,
        this.writable
      );
      this.endOfStream();
      return false;
    }
    let channel0, channel1;
    // handle TypeError: Cannot destructure property 'channel0' of 'this.buffers.get(...)' as it is undefined.
    // while this.buffers.size === 0, this.readable.locked, this.writable.locked
    // can occur where minSamples < 64 in appendBuffers()
    try {
      ({ channel0, channel1 } = this.buffers.get(this.n));
      // glitches can occur when sample frame size is less than 128
      // true at most once, if Float32Array's with length less than 128 in overflow array, last of samples
      if (
        (channel0 && channel0.length < 128) ||
        (channel1 && channel1.length < 128)
      ) {
        console.log(
          channel0.length,
          channel1.length,
          currentTime,
          currentFrame,
          this.buffers.size
        );
      }
    } catch (e) {
      console.error(e, this.buffers.size, this.i, this.n);
      // return true until this.buffers.size > 0
      return true;
    }
    const [[outputChannel0], [outputChannel1]] = outputs;
    outputChannel0.set(channel0);
    outputChannel1.set(channel1);
    this.buffers.delete(this.n);
    ++this.n;
    return true;
  }
};
registerProcessor('audio-data-worklet-stream', AudioDataWorkletStream);

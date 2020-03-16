class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    if (options.processorOptions) {
      Object.assign(this, options.processorOptions);
    }
    this.processStarted = false;
    this.port.onmessage = this.appendBuffers.bind(this);
  }
  async appendBuffers({ data: { readable, processStream } }) {
    processStream = new Function(`return ${processStream}`)();
    // https://github.com/WebAudio/web-audio-api-v2/issues/70
    // store at least minSamples before posting to main thread
    // where resume() is executed then process() for first time
    const minSamples = 64;
    let next = [];
    let overflow = [[], []];
    let init = false;

    globalThis.console.log({
      currentTime,
      currentFrame,
      buffers: this.buffers,
    });

    const strategy = new ByteLengthQueuingStrategy({
      highWaterMark: 32 * 1024,
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
          if (overflow0.length) {
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
        console.log('writable close');
        // handle overflow floats < 128 length
        const [overflow0, overflow1] = overflow;
        if (overflow0.length || overflow1.length) {
          const channel0 = new Float32Array(
            overflow0.splice(0, overflow0.length)
          );
          const channel1 = new Float32Array(
            overflow1.splice(0, overflow1.length)
          );
          this.buffers.set(this.i, {
            channel0,
            channel1,
          });
          ++this.i;
        }
      }
    };

    const writable = new WritableStream(source, strategy);

    Object.assign(this, { readable, writable });

    await readable.pipeTo(writable, {
      preventCancel: true,
    });

    globalThis.console.log('read/write done', {
      currentTime,
      currentFrame,
      overflow,
      next
    });
  }
  endOfStream() {
    this.port.postMessage({
      ended: true,
      currentTime,
      currentFrame
    });
  }
  process(inputs, outputs) {
    if (!this.processStarted) {
      this.processStarted = true;
      console.log(
        'process() first call, currentTime:' +
          currentTime +
          ', this.buffers.size:' +
          this.buffers.size
      );
    }
    if (currentTime > 0.9 && this.buffers.size === 0) {
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
    try {
      // process() can be executed before appendBuffers()
      // where this.buffers is set with values
      // handle this.buffers.get(this.n) being undefined
      // for up to 32 calls to process()
      ({ channel0, channel1 } = this.buffers.get(this.n));
      // glitches can occur when sample frame size is less than 128
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
      // handle this.buffers.size === 0 while this.readable.locked (reading)
      // where entry in this.buffers (Map) deleted and this.writable (writing)
      // not having set new entry this.buffers,
      // resulting in no data to set at currentTime
      // example of JavaScript being single threaded?
      return true;
    }
    const [[outputChannel0], [outputChannel1]] = outputs;
    outputChannel0.set(channel0);
    outputChannel1.set(channel1);
    this.buffers.delete(this.n);
    ++this.n;
    return true;
  }
}
registerProcessor('audio-data-worklet-stream', AudioDataWorkletStream);

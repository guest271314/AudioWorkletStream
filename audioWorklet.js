class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    if (options.processorOptions) {
      Object.assign(this, options.processorOptions);
    }
    this.port.onmessage = this.appendBuffers.bind(this);
  }
  async appendBuffers({
    data: {
      readable, processStream
    }
  }) {
    processStream = new Function(`return ${processStream}`)();
    const THIS = this;
    let next = [];
    let init = false;

    this.port.postMessage({
      start: true,
    });

    globalThis.console.log({
      currentTime,
      currentFrame,
      buffers: this.buffers,
    });

    const writable = new WritableStream({
      async write(value) {
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
        const {
          ch0, ch1
        } = processStream(data);
        while (ch0.length && ch1.length) {
          const channel0 = new Float32Array(ch0.splice(0, 128));
          const channel1 = new Float32Array(ch1.splice(0, 128));
          THIS.buffers.set(THIS.i, {
            channel0, channel1
          });
          ++THIS.i;
        }
      },
    });

    await readable.pipeTo(writable, {
      preventCancel: true,
    });

    globalThis.console.log("read/write done", {
      currentTime, currentFrame
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
    if (this.i > 0 && this.buffers.size === 0) {
      this.endOfStream();
      return false;
    }
    const {
      channel0, channel1
    } = this.buffers.get(this.n);
    const [
      [outputChannel0],
      [outputChannel1]
    ] = outputs;
    outputChannel0.set(channel0);
    outputChannel1.set(channel1);
    this.buffers.delete(this.n);
    ++this.n;
    return true;
  }
}
registerProcessor('audio-data-worklet-stream', AudioDataWorkletStream);

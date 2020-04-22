class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    if (options.processorOptions) {
      Object.assign(this, options.processorOptions);
    }
    this.port.onmessage = this.appendBuffers.bind(this);
    this.processPerSecond = 0;
    this.bool = false;
    this.minSamples = 1024;
  }
  async appendBuffers({ data: { channel0, channel1 } }) {
    this.buffers.set(this.i, {
      channel0,
      channel1,
    });
    ++this.i;
    if (this.i === this.minSamples) {
      console.log(
        'this.buffers.size:' + this.buffers.size,
        currentTime,
        currentFrame
      );
      this.port.postMessage({
        start: true,
      });
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
    if (!this.bool) {
      ++this.processPerSecond;
    }
    if (currentTime >= 0.9985 && !this.bool) {
      console.log(this.processPerSecond, currentTime);
      this.bool = true;
    }
    if (!this.processStarted) {
      this.processStarted = true;
      console.log('process() first call', currentTime, this.buffers.size);
    }
    if (currentTime > 0.9 && this.buffers.size === 0 && this.n === this.i) {
      console.log(
        this.i,
        this.n,
        this.buffers.size
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
}
registerProcessor('audio-data-worklet-stream', AudioDataWorkletStream);

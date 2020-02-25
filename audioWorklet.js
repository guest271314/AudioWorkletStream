class AudioDataWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    if (gc) {
      gc();
    };
    if (options.processorOptions) {
      Object.assign(this, options.processorOptions);
    }; 
    this.port.onmessage = this.appendBuffers.bind(this);
  }
  appendBuffers({
    data: {
      channel0, channel1
    }
  }) {
    this.buffers.channel0.push(channel0);
    this.buffers.channel1.push(channel1);
    ++this.i;
    if (this.i === 1) {
      this.port.postMessage({"start":true});
      globalThis.console.log({
        currentTime, currentFrame, buffers: this.buffers
      });
    };
  }
  endOfStream() {
    this.port
    .postMessage({
      "ended": true,
      currentTime,
      currentFrame
    });
    globalThis.console.log({
      currentTime, currentFrame, sampleRate, buffers: this.buffers
    });
    if (gc) gc();
  }
  process(inputs, outputs) {
    if (this.i > 0 && this.buffers.channel0.length === 0 && this.buffers.channel1.length === 0) { 
      return false;
    }
    for (let channel = 0; channel < outputs.length; ++channel) {
      const [outputChannel] = outputs[channel];
      let inputChannel;
      if (this.i > 0 && this.buffers.channel0.length > 0) {
        inputChannel = this.buffers[`channel${channel}`].shift();
      } else {
        if (this.i > 0 && this.buffers.channel1.length > 0 && this.buffers.channel0.length === 0) {
          // handle channel0.length === 0, channel1.length > 0
          inputChannel = this.buffers.channel1.shift();
          // end of stream
          this.endOfStream();
        };
      };
      outputChannel.set(inputChannel);
    };
    return true;
  };
};
registerProcessor("audio-data-worklet-stream", AudioDataWorkletStream);
// AudioWorkletStream
// Stream audio from Worker to AudioWorklet
// guest271314 2-24-2020
let port;
onmessage = async e => {
  'use strict';
  if (!port) {
    [port] = e.ports;
    port.onmessage = event => postMessage(event.data);
  }
  const { urls } = e.data;
  const { readable, writable } = new TransformStream();
  async function* stream(input) {
    while (input.length) {
      yield (await fetch(input.shift())).body.pipeTo(writable, {
        preventClose: input.length,
      });
    };
  };
  async function read(input) {
    for await (const track of stream(input));
  };
  read(urls);
  port.postMessage(
    {
      readable
    },
    [readable]
  );
};

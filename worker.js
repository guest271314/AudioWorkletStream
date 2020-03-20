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
  port.postMessage(
    {
      readable,
    },
    [readable]
  );
  for await (const _ of (async function* stream() {
    while (urls.length) {
      yield (await fetch(urls.shift())).body.pipeTo(writable, {
        preventClose: !!urls.length,
      });
    }
  })());
  
};

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
  // https://github.com/whatwg/streams/blob/master/transferable-streams-explainer.md
  const { readable, writable } = new TransformStream();
  (async _ => {
    for await (const _ of (async function* stream() {
      while (urls.length) {
        yield (await fetch(urls.shift(), {cache: 'no-store'})).body.pipeTo(writable, {
          preventClose: !!urls.length,
        });
      }
    })());
  })();
  port.postMessage(
    {
      readable,
    },
    [readable]
  );
};

// AudioWorkletStream
// Stream audio from Worker to AudioWorklet (POC)
// guest271314 2-24-2020
let port;
onmessage = async e => {
  'use strict';
  if (!port) {
    [port] = e.ports;
    port.onmessage = event => postMessage(event.data);
  }
  const {
    urls: [url],
  } = e.data;
  const response = await fetch(url);
  const readable = response.body;
  port.postMessage(
    {
      readable,
    },
    [readable]
  );
};

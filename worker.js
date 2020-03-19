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
  const readable = new ReadableStream({
    async start(controller) {
      for (const url of urls) {
        const reader = (await fetch(url)).body.getReader();
        reading: while (true) {
          const { value, done } = await reader.read();
          if (done) {
            console.log('done reading ' + url);
            break reading;
          }
          controller.enqueue(value);
        }
      }
      controller.close();
    },
  });
  port.postMessage(
    {
      readable,
    },
    [readable]
  );
};

let port;
async function* stream(urls) {
  while (urls.length) {
    yield (await fetch(urls.shift())).body;
  }
}
async function* process(reader) {
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    yield port.postMessage(value, [value.buffer]);
  }
}
onmessage = async e => {
  'use strict';
  if (!port) {
    [port] = e.ports;
    port.onmessage = event => postMessage(event.data);
  }
  const { urls, codec } = e.data;
  for await (const readable of stream(urls)) {
    for await (const _ of process(readable.getReader()));
  }
  console.log('read/write done');
};

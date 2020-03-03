// AudioWorkletStream
// Stream audio from Worker to AudioWorklet (POC)
// guest271314 2-24-2020
import {
  CODECS
}
from "./codecs.js";
let port;
onmessage = async e => {
  "use strict";
  if (!port) {
    [port] = e.ports;
    port.onmessage = event => postMessage(event.data);
  }
  const {
    codecs: [mimeCodec],
    urls: [url],
  } = e.data;
  const {
    default: processStream
  } = await
  import (CODECS.get(mimeCodec));
  const response = await fetch(url);
  const readable = response.body;
  port.postMessage({
    readable, processStream: processStream.toString()
  }, [readable]);
};

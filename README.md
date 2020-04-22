# AudioWorkletStream
Stream audio from Worker to AudioWorklet 

<b>`MessagePort.postMessage()` branch</b>

Output audio at Firefox and Chromium (Firefox does not currently support transferable streams or `Worker` with `type` set to `"module"`. Transfer audio as `TypedArray` input using `MessagePort.postMessage()`).

plnkr https://plnkr.co/edit/yh5A66UhMnlpq0JF

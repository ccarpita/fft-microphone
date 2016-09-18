const FFT_SIZE = 2048;
const GRAPH_NORMALIZE = false;
const SKINS = {
  basic: {
    fontSize: 12,
    graph: {
      strokeStyle: 'rgb(0, 0, 0)',
      fillStyle: 'rgb(255, 255, 255)',
      font: '12px serif',
      lineWidth: 2
    },
    text: {
      fillStyle: 'rgb(0, 0, 0)'
    }
  }
};

const frequencyTable = buildEqualTemperamentFrequencyTable();
function buildEqualTemperamentFrequencyTable() {
    var table = {A4: 440};
    // f = 440 * Math.exp(x*ln(2)/12)
    return table;  // TODO: build it
}
function applyStyles(ctx, styles) {
    Object.keys(styles).forEach(key => {
    ctx[key] = styles[key];
  });
}

function withStyles(ctx, styles, doFn) {
  const oldStyles = Object.keys(styles).reduce((acc, n) => {
    acc[n] = ctx[n];
    return acc;
  }, {});
  applyStyles(ctx, styles);
  try {
    doFn();
  } catch(e) { console.error(e); }
  applyStyles(ctx, oldStyles);
}

function formatPeak(peak) {
  const asInt = parseInt(peak, 10);
  if (asInt > 999999 || asInt < 1000) {
      return asInt;
  }
  return parseInt(asInt / 1000, 10) + '.' + (asInt % 1000) + 'k';
}

function maximum(arr) {
  return arr.reduce((acc, next) => next > acc ? next : acc, 0);
}

function compareNumeric(a, b) {
    return a < b ? -1 : (a > b ? 1 : 0);
}

function drawFrequencyData(ctx, data, peaks) {
  const topRange = parseInt(data.length * 0.30, 10);
  const max = maximum(data);
  const scaleY = GRAPH_NORMALIZE ? (max > 32 ? (max * 1.0) : 255.0) : 255.0;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.beginPath();
  for (let i = 0; i < topRange; i++) {
    const v = data[i];
    if (i > 1) {
      const prev = data[i - 1];
      const prev2 = data[i - 2];
      if (prev > v && prev2 <= prev) {
        peaks.push([i - 1, Math.pow(data[i - 1], 10)]);
      }
    }
    const x = 1.0 * width * i / topRange;
    const ratioY = Math.pow(v / scaleY, 10);
    const y = height - height * ratioY;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawDiagnostic(ctx, activeSkin, sampleRate, peaks) {
  const fftStep = sampleRate / FFT_SIZE;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  peaks.sort((a, b) => compareNumeric(b[1], a[1]));
  withStyles(ctx, activeSkin.text, () => {
    let pos = activeSkin.fontSize;
    for (let i = 0; i < 5 && i < peaks.length; i++) {
      const peak = peaks[i];
      if (i > 0 && peaks[i - 1][1] > (8 * peak[1])) {
        break;
      }
      pos += activeSkin.fontSize;
      ctx.fillText("Peak " + i + ": " + formatPeak(peak[0] * fftStep), width - 100, pos);
    }
  });
}

function $click(el, fn) {
  el.addEventListener('click', fn);
  return () => {
    el.removeEventListener('click', fn);
  };
}

function startMonitor(audioContext, analyser, canvasNode, stopNode, startNode) {
  const args = [].slice.apply(arguments);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const ctx = canvasNode.getContext('2d');
  const unsub = [
    $click(startNode, start),
    $click(stopNode, stop)
  ];
  let stopped = false;
  function stop() {
    console.log('stopping...');
    stopped = true;
  }
  function start() {
    stop();
    unsub.forEach(fn => fn());
    startMonitor.apply(null, args);
  }
  const activeSkin = SKINS.basic;
  function step() {
    const width = canvasNode.width = window.innerWidth;
    const height = canvasNode.height = window.innerHeight * 0.80;
    applyStyles(ctx, activeSkin.graph);
    ctx.fillRect(0, 0, width, height);
    const peaks = [];
    analyser.getByteFrequencyData(freqData);
    drawFrequencyData(ctx, freqData, peaks);
    drawDiagnostic(ctx, activeSkin, audioContext.sampleRate, peaks);
    if (!stopped) {
      window.requestAnimationFrame(step);
    }
  }
  window.requestAnimationFrame(step);
}

function getMicrophoneStream() {
  return new Promise((resolve, reject) => {
    navigator.getUserMedia(
        {audio:true},
        resolve,
        reject);
  });
}

const $q = sel => document.querySelector(sel);

function init() {
  const audioContext = new AudioContext();
  getMicrophoneStream()
    .then(audioContext.createMediaStreamSource.bind(audioContext))
    .then(micSource => {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      micSource.connect(analyser);
      startMonitor(
          audioContext,
          analyser,
          $q('canvas'),
          $q('#stop'),
          $q('#start'));
    });
}

init();

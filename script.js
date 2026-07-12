const cameraVideo =
  document.getElementById("cameraVideo");

const captureCanvas =
  document.getElementById("captureCanvas");

const grayCanvas =
  document.getElementById("grayCanvas");

const binaryCanvas =
  document.getElementById("binaryCanvas");

const rawPreview =
  document.getElementById("rawPreview");

const grayPreview =
  document.getElementById("grayPreview");

const binaryPreview =
  document.getElementById("binaryPreview");

const captureContext =
  captureCanvas.getContext("2d", {
    willReadFrequently: true
  });

const grayContext =
  grayCanvas.getContext("2d", {
    willReadFrequently: true
  });

const binaryContext =
  binaryCanvas.getContext("2d", {
    willReadFrequently: true
  });

const rawPreviewContext =
  rawPreview.getContext("2d");

const grayPreviewContext =
  grayPreview.getContext("2d");

const binaryPreviewContext =
  binaryPreview.getContext("2d");

const startButton =
  document.getElementById("startButton");

const stopButton =
  document.getElementById("stopButton");

const statusText =
  document.getElementById("statusText");

const cameraStatus =
  document.getElementById("cameraStatus");

const cameraState =
  document.getElementById("cameraState");

const resolutionText =
  document.getElementById("resolutionText");

const captureCountText =
  document.getElementById("captureCount");

const decodeCountText =
  document.getElementById("decodeCount");

const candidateCountText =
  document.getElementById("candidateCount");

const failureCountText =
  document.getElementById("failureCount");

const cropInfo =
  document.getElementById("cropInfo");

const candidateText =
  document.getElementById("candidateText");

const logText =
  document.getElementById("logText");

const scanFrame =
  document.getElementById("scanFrame");

const resultPanel =
  document.getElementById("resultPanel");

const resultText =
  document.getElementById("resultText");

let mediaStream = null;
let captureTimer = null;

let cameraRunning = false;
let decoding = false;

let captureCount = 0;
let decodeCount = 0;
let candidateCount = 0;
let failureCount = 0;

let lastCandidate = "";
let sameCandidateCount = 0;

let logLines = [];

const CAPTURE_INTERVAL_MS = 1100;

startButton.addEventListener(
  "click",
  startCamera
);

stopButton.addEventListener(
  "click",
  stopCamera
);

window.addEventListener(
  "pagehide",
  stopCamera
);

function setStatus(message) {
  statusText.textContent = message;
  cameraStatus.textContent = message;
  addLog(message);
}

function setCameraState(message) {
  cameraState.textContent = message;
}

function addLog(message) {
  const time =
    new Date().toLocaleTimeString("ja-JP");

  logLines.push(
    "[" + time + "] " + message
  );

  if (logLines.length > 35) {
    logLines.shift();
  }

  logText.textContent =
    logLines.join("\n");

  logText.scrollTop =
    logText.scrollHeight;

  console.log("[診断]", message);
}

function updateStats() {
  captureCountText.textContent =
    String(captureCount);

  decodeCountText.textContent =
    String(decodeCount);

  candidateCountText.textContent =
    String(candidateCount);

  failureCountText.textContent =
    String(failureCount);
}

function resetStats() {
  captureCount = 0;
  decodeCount = 0;
  candidateCount = 0;
  failureCount = 0;

  lastCandidate = "";
  sameCandidateCount = 0;

  candidateText.textContent =
    "未検出";

  logLines = [];
  logText.textContent =
    "待機中";

  updateStats();
}

async function startCamera() {
  if (cameraRunning) {
    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    setStatus(
      "このブラウザではカメラを使用できません"
    );

    return;
  }

  if (typeof Quagga === "undefined") {
    setStatus(
      "Quagga2を読み込めませんでした"
    );

    return;
  }

  resetReadingState();

  startButton.disabled = true;

  setCameraState("起動中");
  setStatus("① カメラを起動しています…");

  try {
    mediaStream =
      await navigator.mediaDevices.getUserMedia({
        audio: false,

        video: {
          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1920
          },

          height: {
            ideal: 1080
          }
        }
      });

    cameraVideo.srcObject =
      mediaStream;

    await waitForVideoReady();
    await cameraVideo.play();

    cameraRunning = true;

    startButton.classList.add(
      "hidden"
    );

    stopButton.classList.remove(
      "hidden"
    );

    const track =
      mediaStream.getVideoTracks()[0];

    const settings =
      track.getSettings();

    const width =
      settings.width ||
      cameraVideo.videoWidth;

    const height =
      settings.height ||
      cameraVideo.videoHeight;

    resolutionText.textContent =
      width + "×" + height;

    setCameraState("起動中");

    setStatus(
      "② カメラ起動完了。バーコードだけを細い枠へ合わせてください"
    );

    addLog(
      "実映像：" +
      cameraVideo.videoWidth +
      "×" +
      cameraVideo.videoHeight
    );

    setTimeout(
      startCaptureLoop,
      1200
    );

  } catch (error) {
    console.error(error);

    setCameraState("エラー");

    setStatus(
      "カメラを起動できませんでした"
    );

    addLog(
      error.name + ": " + error.message
    );

    startButton.disabled = false;
  }
}

function waitForVideoReady() {
  return new Promise(
    (resolve, reject) => {
      if (
        cameraVideo.readyState >= 2 &&
        cameraVideo.videoWidth > 0
      ) {
        resolve();
        return;
      }

      const timeout =
        setTimeout(() => {
          reject(
            new Error(
              "カメラ映像の準備が完了しませんでした"
            )
          );
        }, 8000);

      cameraVideo.addEventListener(
        "loadedmetadata",
        function handleMetadata() {
          clearTimeout(timeout);
          resolve();
        },
        {
          once: true
        }
      );
    }
  );
}

function startCaptureLoop() {
  if (!cameraRunning) {
    return;
  }

  clearInterval(captureTimer);

  setStatus(
    "③ バーコード探索中…"
  );

  captureTimer =
    setInterval(
      captureAndDecodeFrame,
      CAPTURE_INTERVAL_MS
    );

  captureAndDecodeFrame();
}

async function captureAndDecodeFrame() {
  if (
    !cameraRunning ||
    decoding ||
    cameraVideo.readyState < 2
  ) {
    return;
  }

  decoding = true;

  try {
    const crop =
      createBarcodeCrop();

    if (!crop) {
      failureCount += 1;
      updateStats();

      addLog(
        "切り出し画像の取得に失敗"
      );

      return;
    }

    captureCount += 1;
    updateStats();

    createProcessedImages();
    showAllPreviews();

    cropInfo.textContent =
      "元映像：" +
      cameraVideo.videoWidth +
      "×" +
      cameraVideo.videoHeight +
      "／切出：" +
      crop.width +
      "×" +
      crop.height +
      "／位置：" +
      crop.x +
      "," +
      crop.y;

    scanFrame.classList.add(
      "detecting"
    );

    setStatus(
      "④ 生・グレー・二値化を解析中…"
    );

    const variants = [
      {
        name: "生画像",
        canvas: captureCanvas
      },
      {
        name: "グレースケール",
        canvas: grayCanvas
      },
      {
        name: "二値化",
        canvas: binaryCanvas
      }
    ];

    let detectedCode = null;
    let detectedMethod = "";

    for (const variant of variants) {
      decodeCount += 1;
      updateStats();

      const code =
        await decodeCanvas(
          variant.canvas
        );

      if (code) {
        detectedCode = code;
        detectedMethod =
          variant.name;

        break;
      }
    }

    if (!detectedCode) {
      failureCount += 1;
      updateStats();

      setStatus(
        "③ 探索中…バーコードだけを枠内へ映してください"
      );

      addLog(
        "取得" +
        captureCount +
        "：3方式とも結果なし"
      );

      return;
    }

    candidateCount += 1;
    updateStats();

    candidateText.textContent =
      detectedCode +
      "（" +
      detectedMethod +
      "）";

    setStatus(
      "⑤ 番号を検出。再確認中…"
    );

    addLog(
      "候補：" +
      detectedCode +
      "／方式：" +
      detectedMethod
    );

    if (
      detectedCode === lastCandidate
    ) {
      sameCandidateCount += 1;
    } else {
      lastCandidate =
        detectedCode;

      sameCandidateCount = 1;
    }

    if (
      sameCandidateCount >= 2
    ) {
      finishReading(
        detectedCode,
        detectedMethod
      );
    }

  } catch (error) {
    console.error(error);

    failureCount += 1;
    updateStats();

    setStatus(
      "解析処理でエラーが発生しました"
    );

    addLog(
      error.name + ": " + error.message
    );

  } finally {
    decoding = false;

    if (cameraRunning) {
      setTimeout(() => {
        scanFrame.classList.remove(
          "detecting"
        );
      }, 220);
    }
  }
}

/*
  画面上の細い読取枠と一致する範囲を、
  元映像から正確に切り出す。
*/
function createBarcodeCrop() {
  const videoWidth =
    cameraVideo.videoWidth;

  const videoHeight =
    cameraVideo.videoHeight;

  if (
    !videoWidth ||
    !videoHeight
  ) {
    return null;
  }

  const videoRect =
    cameraVideo.getBoundingClientRect();

  const frameRect =
    scanFrame.getBoundingClientRect();

  const scale =
    Math.max(
      videoRect.width / videoWidth,
      videoRect.height / videoHeight
    );

  const renderedWidth =
    videoWidth * scale;

  const renderedHeight =
    videoHeight * scale;

  const hiddenX =
    (renderedWidth - videoRect.width) / 2;

  const hiddenY =
    (renderedHeight - videoRect.height) / 2;

  const frameLeft =
    frameRect.left - videoRect.left;

  const frameTop =
    frameRect.top - videoRect.top;

  let sourceX =
    (frameLeft + hiddenX) / scale;

  let sourceY =
    (frameTop + hiddenY) / scale;

  let sourceWidth =
    frameRect.width / scale;

  let sourceHeight =
    frameRect.height / scale;

  sourceX =
    Math.max(
      0,
      Math.min(
        videoWidth - 1,
        sourceX
      )
    );

  sourceY =
    Math.max(
      0,
      Math.min(
        videoHeight - 1,
        sourceY
      )
    );

  sourceWidth =
    Math.min(
      sourceWidth,
      videoWidth - sourceX
    );

  sourceHeight =
    Math.min(
      sourceHeight,
      videoHeight - sourceY
    );

  const outputWidth =
    Math.min(
      1600,
      Math.round(sourceWidth)
    );

  const outputHeight =
    Math.max(
      1,
      Math.round(
        outputWidth *
        (sourceHeight / sourceWidth)
      )
    );

  captureCanvas.width =
    outputWidth;

  captureCanvas.height =
    outputHeight;

  captureContext.fillStyle =
    "#ffffff";

  captureContext.fillRect(
    0,
    0,
    outputWidth,
    outputHeight
  );

  captureContext.drawImage(
    cameraVideo,

    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,

    0,
    0,
    outputWidth,
    outputHeight
  );

  return {
    x: Math.round(sourceX),
    y: Math.round(sourceY),
    width: outputWidth,
    height: outputHeight
  };
}

function createProcessedImages() {
  const width =
    captureCanvas.width;

  const height =
    captureCanvas.height;

  grayCanvas.width = width;
  grayCanvas.height = height;

  binaryCanvas.width = width;
  binaryCanvas.height = height;

  grayContext.drawImage(
    captureCanvas,
    0,
    0
  );

  const grayImageData =
    grayContext.getImageData(
      0,
      0,
      width,
      height
    );

  const grayPixels =
    grayImageData.data;

  for (
    let index = 0;
    index < grayPixels.length;
    index += 4
  ) {
    const gray =
      grayPixels[index] * 0.299 +
      grayPixels[index + 1] * 0.587 +
      grayPixels[index + 2] * 0.114;

    const contrasted =
      Math.max(
        0,
        Math.min(
          255,
          (gray - 128) * 1.28 + 128
        )
      );

    grayPixels[index] =
      contrasted;

    grayPixels[index + 1] =
      contrasted;

    grayPixels[index + 2] =
      contrasted;
  }

  grayContext.putImageData(
    grayImageData,
    0,
    0
  );

  binaryContext.drawImage(
    grayCanvas,
    0,
    0
  );

  const binaryImageData =
    binaryContext.getImageData(
      0,
      0,
      width,
      height
    );

  const binaryPixels =
    binaryImageData.data;

  for (
    let index = 0;
    index < binaryPixels.length;
    index += 4
  ) {
    const value =
      binaryPixels[index] < 150
        ? 0
        : 255;

    binaryPixels[index] =
      value;

    binaryPixels[index + 1] =
      value;

    binaryPixels[index + 2] =
      value;
  }

  binaryContext.putImageData(
    binaryImageData,
    0,
    0
  );
}

function showAllPreviews() {
  copyCanvas(
    captureCanvas,
    rawPreview,
    rawPreviewContext
  );

  copyCanvas(
    grayCanvas,
    grayPreview,
    grayPreviewContext
  );

  copyCanvas(
    binaryCanvas,
    binaryPreview,
    binaryPreviewContext
  );
}

function copyCanvas(
  sourceCanvas,
  targetCanvas,
  targetContext
) {
  targetCanvas.width =
    sourceCanvas.width;

  targetCanvas.height =
    sourceCanvas.height;

  targetContext.drawImage(
    sourceCanvas,
    0,
    0
  );
}

function decodeCanvas(canvas) {
  const imageDataUrl =
    canvas.toDataURL(
      "image/png"
    );

  return new Promise(resolve => {
    Quagga.decodeSingle(
      {
        src: imageDataUrl,

        numOfWorkers: 0,

        inputStream: {
          size: 1600
        },

        locator: {
          patchSize: "medium",
          halfSample: false
        },

        decoder: {
          readers: [
            "codabar_reader"
          ],

          multiple: false
        },

        locate: true
      },

      function handleDecode(result) {
        const code =
          result?.codeResult?.code;

        resolve(code || null);
      }
    );
  });
}

function finishReading(
  code,
  detectedMethod
) {
  if (!cameraRunning) {
    return;
  }

  clearInterval(captureTimer);

  scanFrame.classList.remove(
    "detecting"
  );

  scanFrame.classList.add(
    "success"
  );

  setStatus(
    "⑥ バーコード読み取り完了！"
  );

  candidateText.textContent =
    code +
    "（確定・" +
    detectedMethod +
    "）";

  resultPanel.classList.remove(
    "hidden"
  );

  resultText.innerHTML =
    escapeHtml(code) +
    "<br><br>" +
    "読取方式：" +
    escapeHtml(detectedMethod);

  addLog(
    "読取確定：" + code
  );

  if (navigator.vibrate) {
    navigator.vibrate([
      100,
      70,
      160
    ]);
  }

  stopCameraStream();

  setCameraState("完了");

  stopButton.classList.add(
    "hidden"
  );

  startButton.classList.remove(
    "hidden"
  );

  startButton.disabled = false;

  startButton.textContent =
    "別のレシートを読む";
}

function resetReadingState() {
  clearInterval(captureTimer);

  stopCameraStream();

  cameraRunning = false;
  decoding = false;

  resetStats();

  resultPanel.classList.add(
    "hidden"
  );

  resultText.textContent = "";

  scanFrame.classList.remove(
    "detecting",
    "success"
  );

  resolutionText.textContent =
    "―";

  cropInfo.textContent =
    "まだ画像を取得していません";

  clearPreview(
    rawPreview,
    rawPreviewContext
  );

  clearPreview(
    grayPreview,
    grayPreviewContext
  );

  clearPreview(
    binaryPreview,
    binaryPreviewContext
  );
}

function clearPreview(
  canvas,
  context
) {
  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
}

function stopCamera() {
  clearInterval(captureTimer);

  stopCameraStream();

  cameraRunning = false;
  decoding = false;

  scanFrame.classList.remove(
    "detecting",
    "success"
  );

  stopButton.classList.add(
    "hidden"
  );

  startButton.classList.remove(
    "hidden"
  );

  startButton.disabled = false;

  startButton.textContent =
    "もう一度読む";

  setCameraState("停止");

  setStatus(
    "カメラを停止しました"
  );
}

function stopCameraStream() {
  if (mediaStream) {
    mediaStream
      .getTracks()
      .forEach(track => {
        track.stop();
      });
  }

  mediaStream = null;
  cameraVideo.srcObject = null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

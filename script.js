const cameraStage =
  document.getElementById("cameraStage");

const cameraVideo =
  document.getElementById("cameraVideo");

const captureCanvas =
  document.getElementById("captureCanvas");

const processCanvas =
  document.getElementById("processCanvas");

const previewCanvas =
  document.getElementById("previewCanvas");

const captureContext =
  captureCanvas.getContext("2d", {
    willReadFrequently: true
  });

const processContext =
  processCanvas.getContext("2d", {
    willReadFrequently: true
  });

const previewContext =
  previewCanvas.getContext("2d");

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

const CAPTURE_INTERVAL_MS = 950;

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

  if (logLines.length > 30) {
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
      "② カメラ起動完了。バーコードを枠へ合わせてください"
    );

    addLog(
      "実映像：" +
      cameraVideo.videoWidth +
      "×" +
      cameraVideo.videoHeight
    );

    /*
      オートフォーカスを待つ。
    */
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

    showPreview();

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
      "④ 静止画を解析中…"
    );

    /*
      3種類の画像を順番に試す。
      1. 生画像
      2. グレースケール＋コントラスト
      3. 二値化
    */
    const variants =
      createImageVariants();

    let detectedCode = null;
    let detectedMethod = "";

    for (
      const variant of variants
    ) {
      decodeCount += 1;
      updateStats();

      const code =
        await decodeImage(
          variant.dataUrl
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
        "③ 探索中…バーコードを大きく、まっすぐ映してください"
      );

      addLog(
        "取得" +
        captureCount +
        "：3方式すべて結果なし"
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
  表示中の読取枠と一致するように、
  object-fit: cover の倍率を逆算して
  元動画から切り出す。
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

  const displayWidth =
    videoRect.width;

  const displayHeight =
    videoRect.height;

  /*
    object-fit: cover の表示倍率。
  */
  const scale =
    Math.max(
      displayWidth / videoWidth,
      displayHeight / videoHeight
    );

  const renderedWidth =
    videoWidth * scale;

  const renderedHeight =
    videoHeight * scale;

  const hiddenX =
    (renderedWidth - displayWidth) / 2;

  const hiddenY =
    (renderedHeight - displayHeight) / 2;

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

  /*
    最大1600pxで出力。
  */
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

function showPreview() {
  previewCanvas.width =
    captureCanvas.width;

  previewCanvas.height =
    captureCanvas.height;

  previewContext.drawImage(
    captureCanvas,
    0,
    0
  );
}

function createImageVariants() {
  const variants = [];

  /*
    ① 生画像
  */
  variants.push({
    name: "生画像",
    dataUrl:
      captureCanvas.toDataURL(
        "image/png"
      )
  });

  /*
    処理用Canvasへ複製。
  */
  processCanvas.width =
    captureCanvas.width;

  processCanvas.height =
    captureCanvas.height;

  processContext.drawImage(
    captureCanvas,
    0,
    0
  );

  const imageData =
    processContext.getImageData(
      0,
      0,
      processCanvas.width,
      processCanvas.height
    );

  const pixels =
    imageData.data;

  /*
    ② グレースケール＋軽いコントラスト
  */
  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    const gray =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;

    const contrasted =
      Math.max(
        0,
        Math.min(
          255,
          (gray - 128) * 1.22 + 128
        )
      );

    pixels[index] =
      contrasted;

    pixels[index + 1] =
      contrasted;

    pixels[index + 2] =
      contrasted;
  }

  processContext.putImageData(
    imageData,
    0,
    0
  );

  variants.push({
    name: "グレースケール",
    dataUrl:
      processCanvas.toDataURL(
        "image/png"
      )
  });

  /*
    ③ 二値化
  */
  const binaryData =
    processContext.getImageData(
      0,
      0,
      processCanvas.width,
      processCanvas.height
    );

  const binaryPixels =
    binaryData.data;

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

  processContext.putImageData(
    binaryData,
    0,
    0
  );

  variants.push({
    name: "二値化",
    dataUrl:
      processCanvas.toDataURL(
        "image/png"
      )
  });

  return variants;
}

function decodeImage(imageDataUrl) {
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

  const parsed =
    parseLifeReceiptCode(code);

  if (parsed) {
    resultText.innerHTML =
      escapeHtml(code) +
      "<br><br>" +
      "購入日：" +
      escapeHtml(
        parsed.purchaseDate
      ) +
      "<br>" +
      "レジ番号：" +
      escapeHtml(
        parsed.registerNo
      ) +
      "<br>" +
      "レシートNo：" +
      escapeHtml(
        parsed.receiptNo
      );
  } else {
    resultText.innerHTML =
      escapeHtml(code) +
      "<br><br>" +
      "方式：" +
      escapeHtml(detectedMethod);
  }

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

function parseLifeReceiptCode(code) {
  const match =
    /^([A-D])(\d{8})(\d{4})(\d{4})([A-D])$/
      .exec(code);

  if (!match) {
    return null;
  }

  return {
    startCharacter: match[1],
    purchaseDate: match[2],
    registerNo: match[3],
    receiptNo: match[4],
    stopCharacter: match[5]
  };
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

  previewContext.clearRect(
    0,
    0,
    previewCanvas.width,
    previewCanvas.height
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

  setStatus("カメラを停止しました");
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

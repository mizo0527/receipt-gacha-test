const cameraVideo =
  document.getElementById("cameraVideo");

const captureCanvas =
  document.getElementById("captureCanvas");

const captureContext =
  captureCanvas.getContext("2d", {
    willReadFrequently: true
  });

const startButton =
  document.getElementById("startButton");

const stopButton =
  document.getElementById("stopButton");

const statusText =
  document.getElementById("statusText");

const debugText =
  document.getElementById("debugText");

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
let frameNumber = 0;

let lastCandidate = "";
let sameCandidateCount = 0;

const CAPTURE_INTERVAL_MS = 850;

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
  console.log("[状態]", message);
}

function setDebug(message) {
  debugText.textContent = message;
  console.log("[診断]", message);
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
      "バーコード読取ライブラリを読み込めませんでした"
    );

    return;
  }

  resetReadingState();

  startButton.disabled = true;

  setStatus("① カメラを起動しています…");
  setDebug("カメラ許可を確認中");

  try {
    mediaStream =
      await navigator.mediaDevices.getUserMedia({
        audio: false,

        video: {
          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 3840
          },

          height: {
            ideal: 2160
          }
        }
      });

    cameraVideo.srcObject = mediaStream;

    await waitForVideoReady();

    await cameraVideo.play();

    cameraRunning = true;

    startButton.classList.add("hidden");
    stopButton.classList.remove("hidden");

    const videoTrack =
      mediaStream.getVideoTracks()[0];

    const settings =
      videoTrack.getSettings();

    setStatus(
      "② カメラ起動完了。バーコードを枠へ合わせてください"
    );

    setDebug(
      "映像: " +
      cameraVideo.videoWidth +
      "×" +
      cameraVideo.videoHeight +
      " / 実設定: " +
      (settings.width || "?") +
      "×" +
      (settings.height || "?")
    );

    /*
      オートフォーカスが落ち着くまで少し待つ。
    */
    setTimeout(
      startCaptureLoop,
      900
    );

  } catch (error) {
    console.error(error);

    setStatus(
      "カメラを起動できませんでした"
    );

    setDebug(
      error.name + ": " + error.message
    );

    startButton.disabled = false;
  }
}

function waitForVideoReady() {
  return new Promise((resolve, reject) => {
    if (
      cameraVideo.readyState >= 2 &&
      cameraVideo.videoWidth > 0
    ) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
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
  });
}

function startCaptureLoop() {
  if (!cameraRunning) {
    return;
  }

  clearInterval(captureTimer);

  setStatus(
    "③ バーコードを探しています…"
  );

  captureTimer = setInterval(
    captureAndDecodeFrame,
    CAPTURE_INTERVAL_MS
  );

  /*
    最初の1回は待たずに実行。
  */
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
  frameNumber += 1;

  try {
    const frameDataUrl =
      createBarcodeCrop();

    if (!frameDataUrl) {
      setDebug(
        "フレーム " +
        frameNumber +
        "：画像取得失敗"
      );

      return;
    }

    setStatus(
      "④ バーコード検知・解析中…そのまま動かさないでください"
    );

    scanFrame.classList.add(
      "detecting"
    );

    setDebug(
      "フレーム " +
      frameNumber +
      " を静止画解析中"
    );

    const code =
      await decodeCapturedImage(
        frameDataUrl
      );

    if (!code) {
      setStatus(
        "③ バーコードを探しています…枠内へ大きく映してください"
      );

      setDebug(
        "フレーム " +
        frameNumber +
        "：デコード結果なし"
      );

      return;
    }

    setStatus(
      "⑤ 番号を検出しました。再確認中…"
    );

    setDebug(
      "候補：" + code
    );

    /*
      同じ結果を2回検出したら確定。
    */
    if (code === lastCandidate) {
      sameCandidateCount += 1;
    } else {
      lastCandidate = code;
      sameCandidateCount = 1;
    }

    if (sameCandidateCount >= 2) {
      finishReading(code);
    }

  } catch (error) {
    console.error(error);

    setDebug(
      "フレーム " +
      frameNumber +
      "：解析エラー"
    );

  } finally {
    decoding = false;

    if (cameraRunning) {
      setTimeout(() => {
        scanFrame.classList.remove(
          "detecting"
        );
      }, 250);
    }
  }
}

/*
  カメラ映像の中央にある
  横長領域だけを高解像度で切り出す。
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

  /*
    元映像の横92％・縦30％を使用。
  */
  const cropWidth =
    Math.floor(videoWidth * 0.92);

  const cropHeight =
    Math.floor(videoHeight * 0.3);

  const sourceX =
    Math.floor(
      (videoWidth - cropWidth) / 2
    );

  const sourceY =
    Math.floor(
      (videoHeight - cropHeight) / 2
    );

  /*
    細い線を維持するため、
    出力幅を最大1600pxにする。
  */
  const outputWidth =
    Math.min(1600, cropWidth);

  const outputHeight =
    Math.round(
      outputWidth *
      (cropHeight / cropWidth)
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
    cropWidth,
    cropHeight,

    0,
    0,
    outputWidth,
    outputHeight
  );

  /*
    コントラストを軽く強化。
    完全二値化はまだ行わない。
  */
  improveContrast(
    captureContext,
    outputWidth,
    outputHeight
  );

  return captureCanvas.toDataURL(
    "image/jpeg",
    0.96
  );
}

function improveContrast(
  context,
  width,
  height
) {
  const imageData =
    context.getImageData(
      0,
      0,
      width,
      height
    );

  const pixels =
    imageData.data;

  const contrast = 1.28;

  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    const red =
      pixels[index];

    const green =
      pixels[index + 1];

    const blue =
      pixels[index + 2];

    /*
      グレースケール化。
    */
    let gray =
      red * 0.299 +
      green * 0.587 +
      blue * 0.114;

    /*
      中間値を中心に軽くコントラスト強化。
    */
    gray =
      (gray - 128) *
      contrast +
      128;

    gray =
      Math.max(
        0,
        Math.min(255, gray)
      );

    pixels[index] =
      gray;

    pixels[index + 1] =
      gray;

    pixels[index + 2] =
      gray;
  }

  context.putImageData(
    imageData,
    0,
    0
  );
}

function decodeCapturedImage(
  imageDataUrl
) {
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

function finishReading(code) {
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

  setDebug(
    "確定：" + code
  );

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
      escapeHtml(parsed.purchaseDate) +
      "<br>" +
      "レジ番号：" +
      escapeHtml(parsed.registerNo) +
      "<br>" +
      "レシートNo：" +
      escapeHtml(parsed.receiptNo);
  } else {
    resultText.innerHTML =
      escapeHtml(code) +
      "<br><br>" +
      "バーコードは読めました。<br>" +
      "形式の解析は次の工程で行います。";
  }

  if (navigator.vibrate) {
    navigator.vibrate([
      100,
      70,
      160
    ]);
  }

  stopCameraStream();

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
  /*
    現在判明している想定：
    A + 数字16桁 + A
  */
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

  cameraRunning = false;
  decoding = false;
  frameNumber = 0;

  lastCandidate = "";
  sameCandidateCount = 0;

  resultPanel.classList.add(
    "hidden"
  );

  resultText.textContent = "";

  scanFrame.classList.remove(
    "detecting",
    "success"
  );

  setDebug("初期化完了");
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

  setStatus("停止しました");
  setDebug("カメラ停止");
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

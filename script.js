const resultBox = document.createElement("div");
resultBox.id = "resultBox";
resultBox.style.marginTop = "20px";
resultBox.style.fontSize = "18px";
resultBox.style.fontWeight = "bold";
resultBox.innerText = "読み取り結果：未読取";
document.body.appendChild(resultBox);

const html5QrCode = new Html5Qrcode("camera");

document.getElementById("scanButton").addEventListener("click", () => {
  resultBox.innerText = "カメラ起動中...";

  html5QrCode.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 280, height: 120 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8
      ]
    },
    decodedText => {
      resultBox.innerText = "読み取り成功：\n" + decodedText;

      html5QrCode.stop();
    },
    errorMessage => {
      // 読取中の失敗は毎回出るので無視
    }
  ).catch(err => {
    resultBox.innerText = "カメラ起動失敗：\n" + err;
  });
});

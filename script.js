async function startCamera() {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            }
        });

        document.getElementById("camera").srcObject = stream;

    } catch (err) {

        alert("カメラが起動できませんでした。");

        console.error(err);

    }

}

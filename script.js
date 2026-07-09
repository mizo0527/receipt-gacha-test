document.getElementById("scanButton").addEventListener("click", async () => {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            }
        });

        const video = document.getElementById("camera");

        video.srcObject = stream;

        video.play();

    } catch (e) {

        alert("カメラを起動できませんでした");

        console.log(e);

    }

});

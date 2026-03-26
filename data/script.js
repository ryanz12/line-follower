var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
var ledOn = false;
var robotOn = 0;

let state = document.getElementById("robot-state");

window.addEventListener('load', onload);

function onload(event) {
    initWebSocket();

    const powerButton = document.getElementById("powerButton");
    
    powerButton.onclick = () => {
        // Check if the websocket is actually open before sending
        if (websocket.readyState === WebSocket.OPEN) {
            console.log("Trying to send something")
            websocket.send("TOGGLE");
            console.log("SENT TOGGLE");
        } else {
            console.log("Websocket is not open yet.");
        }
    };
}

function updateUI(data) {
    if (data.type === "state") {
        robotOn = data.value

        state.textContent = (robotOn == 1) ? "ON" : "OFF";
    }

    else if (data.type === "sensors") {
    }
}

function initWebSocket() {
    console.log("Trying to open a websocket connection");
    websocket = new WebSocket(gateway);

    websocket.onopen = function(event) {
        console.log("Connection opened");
        websocket.send("STATE");
    };

    websocket.onclose = function(event) {
        console.log("Connection closed");
        // Optional: Attempt to reconnect after 2 seconds
        setTimeout(initWebSocket, 2000);
    };

    // Client receives ws message from server
    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        updateUI(data);
        console.log(data);
    };
}
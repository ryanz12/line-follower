var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
var ledOn = false;

window.addEventListener('load', onload);

function onload(event) {
    initWebSocket();
    // Move the button assignment here to ensure the HTML exists
    const powerButton = document.getElementById("powerButton");
    
    powerButton.onclick = () => {
        // Check if the websocket is actually open before sending
        if (websocket.readyState === WebSocket.OPEN) {
            console.log("Trying to send something")
            if (ledOn) {
                websocket.send("STOP");   // If it was ON, turn it OFF
                console.log("sent STOP")
            } else {
                websocket.send("START");  // If it was OFF, turn it ON
                console.log("sent START")
            }
            ledOn = !ledOn; // Flip the local state
        } else {
            console.log("Websocket is not open yet.");
        }
    };
}

function initWebSocket() {
    console.log("Trying to open a websocket connection");
    websocket = new WebSocket(gateway);

    websocket.onopen = function(event) {
        console.log("Connection opened");
    };

    websocket.onclose = function(event) {
        console.log("Connection closed");
        // Optional: Attempt to reconnect after 2 seconds
        setTimeout(initWebSocket, 2000);
    };
}
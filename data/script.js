var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
var ledOn = false;
var robotOn = 0;

let state = document.getElementById("robot-state");

window.addEventListener('load', onload);

let chart;
let chartData = [];
let chartLabels = [];

function initChart() {
    const ctx = document.getElementById('positionChart').getContext('2d');

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Line Position',
                data: chartData,
                borderWidth: 2,
                tension: 0.2
            }]
        },
        options: {
            animation: false,
            responsive: true,
            scales: {
                y: {
                    suggestedMin: 0,
                    suggestedMax: 7000               
                }
            }
        }
    });
}


function onload(event) {
    initWebSocket();

    const powerButton = document.getElementById("powerButton");
    const recalButton = document.getElementById("recalibrate");
    const speedSlider = document.getElementById("speed");
    
    powerButton.onclick = () => {
        // Check if the websocket is actually open before sending
        if (websocket.readyState === WebSocket.OPEN) {
            const msg = {
                type: "request_toggle"
            };

            console.log("Trying to send something")
            websocket.send(JSON.stringify(msg));
            console.log("SENT TOGGLE");
        } 
        else {
            console.log("Websocket is not open yet.");
        }
    };

    recalButton.onclick = () => {
        if (websocket.readyState === WebSocket.OPEN) {
            const msg = {
                type: "request_recalibrate"
            };

            console.log("Trying to send something")
            websocket.send(JSON.stringify(msg));
            console.log("SENT RECALIBRATE");
        } 
        else {
            console.log("Websocket is not open yet.");
        }
    }

    speedSlider.oninput = () => {
        if (websocket.readyState === WebSocket.OPEN){
            const speedValue = speedSlider.value;

            const msg = {
                type: "request_change_speed",
                speed: parseInt(speedValue)
            };

            websocket.send(JSON.stringify(msg));
        }
        else {
            console.log("WebSocket is not open yet.")
        }
    }

    const kp = document.getElementById("kP"); 
    const ki = document.getElementById("kI"); 
    const kd = document.getElementById("kD"); 

    function sendPID(){
        if (websocket.readyState === WebSocket.OPEN){
            const msg = {
                type: "set_pid",
                kP: parseFloat(kp.value) || 0,
                kI: parseFloat(ki.value) || 0,
                kD: parseFloat(kd.value) || 0
            };

            websocket.send(JSON.stringify(msg));
        }
    }

    [kp, ki, kd].forEach(x => {
        x.addEventListener("change", sendPID);
    })

    initChart();
}

function updateUI(data) {
    if (data.type === "state") {
        robotOn = data.value

        state.textContent = (robotOn == 1) ? "ON" : "OFF";
    }

    else if (data.type === "sensors") {
        const pos = data.position;

        chartData.push(pos);
        chartLabels.push(""); // or timestamp

        if (chartData.length > 50) {
            chartData.shift();
            chartLabels.shift();
        }

        chart.update();
    }
}

function initWebSocket() {
    console.log("Trying to open a websocket connection");
    websocket = new WebSocket(gateway);

    websocket.onopen = function(event) {
        console.log("Connection opened");
        const msg = {
            type: "request_state"
        }
        websocket.send(JSON.stringify(msg));
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

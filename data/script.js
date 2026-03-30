const gateway = `ws://${window.location.hostname}/ws`;
let websocket;
let robotOn = false;

let chart, sensorChart;
let chartLabels = [];
let positionData = [];
let errorData = [];
const sensorValues = new Array(8).fill(0);
let setpoint = 3500;

const powerButton = document.getElementById("powerButton");
const recalButton = document.getElementById("recalibrateButton");
const speedSlider = document.getElementById("speedSlider");
const speedLabel = document.getElementById("speedLabel");
const kpInput = document.getElementById("kPInput");
const kiInput = document.getElementById("kIInput");
const kdInput = document.getElementById("kDInput");
const stateText = document.getElementById("robot-state");
const spInput = document.getElementById("setpointInput");

const message_server = (data) => {
    if (websocket.readyState !== WebSocket.OPEN){
        console.log("Web socket is not ready yet");
        return;
    }
    websocket.send(JSON.stringify(data));
    console.log("Sent message: ", data);
};

const initWebSocket = () => {
    console.log("Trying to open a web socket connection");
    websocket = new WebSocket(gateway);
    
    websocket.onopen = (e) => {
        console.log("Connection established");
        const msg = {
            type: "request_state"
        };
        message_server(msg);
    };

    websocket.onclose = (e) => {
        console.log("Connection closed");
        
        // try reconnect after 2 seconds
        setTimeout(initWebSocket, 2000);
    };

    // handle receiving message
    websocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        updateUI(data);
        console.log(data);
    }
};

const initChart = () => {
    const posChart = document.getElementById("positionChart").getContext("2d");
    const sChart = document.getElementById("sensorChart").getContext("2d");

    chart = new Chart(posChart, {
        type: "line",
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: "Position",
                    data: positionData,
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: "Error",
                    data: errorData,
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: "Middle Position",
                    data: new Array(50).fill(setpoint),
                    borderWidth: 2,
                    tension: 0.2
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            animation: false,
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: "#c0caf5"
                    },
                    grid: {
                        color: "#414868"
                    }
                },
                x: {
                    grid: {
                        color: "#414868"
                    }
                }
            }
        }
    });

    sensorChart = new Chart(sChart, {
        type: "bar",
        data: {
            labels: ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7"],
            datasets: [{
                label: "Sensor Values",
                data: sensorValues,
                borderWidth: 1
            }]
        },
        options: {
            maintainAspectRatio: false,
            animation: {
                duration: 100,
                easing: "linear"
            },
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 1000,
                    ticks: {
                        color: "#c0caf5"
                    },
                    grid: {
                        color: "#414868"
                    }
                },
                x: {
                    grid: {
                        color: "#414868"
                    }
                }
            }
        }
    });
};

const updateUI = (data) => {

    if (Object.hasOwn(data, "state")){
        switch(data.state){
            case "0":
                stateText.innerHTML = "Robot Status: OFF";
                stateText.className = "robot-off";
                powerButton.className = "button-on";
                powerButton.innerHTML = "Turn ON"
                break;
            case "1":
                stateText.innerHTML = "Robot Status: ON";
                stateText.className = "robot-on";
                powerButton.className = "button-off";
                powerButton.innerHTML = "Turn OFF"
                recalButton.disabled = false;
                break;
            case "2":
                stateText.innerHTML = "Robot Status: RECALIBRATING";
                stateText.className = "robot-recal";
                recalButton.disabled = true;
                break;
        }
    }
    else if (data.type === "sensors"){
        const pos = data.position;
        const err = data.error;

        positionData.push(pos);
        errorData.push(err);
        chartLabels.push("");

        if (positionData.length > 50){
            positionData.shift();
            errorData.shift();
            chartLabels.shift();
        }

        chart.data.datasets[0].data = positionData;
        chart.data.datasets[1].data = errorData;
        chart.data.datasets[2].data = new Array(positionData.length).fill(setpoint);
        chart.update();

        data.sensors.forEach((val, index) => {
            sensorChart.data.datasets[0].data[index] = val;
        });

        sensorChart.update();
    }
};

window.addEventListener("load", (e) => {
    // init websocket
    initWebSocket();

    
    // bind events to HTML
    powerButton.addEventListener("click", (ev) => {
        const msg = {
            type: "request_toggle"
        };
        message_server(msg);
    });

    recalButton.addEventListener("click", (ev) => {
        const msg = {
            type: "request_recalibrate"
        };
        message_server(msg);
    });

    speedSlider.addEventListener("input", (ev) => {
        speedLabel.innerHTML = `Speed: ${speedSlider.value}`;

        const msg = {
            type: "request_change_speed",
            speed: parseInt(speedSlider.value)
        };
        message_server(msg);
    });

    spInput.addEventListener("change", (ev) => {
        setpoint = spInput.value;

        const msg = {
            type: "set_ff",
            ff: parseInt(setpoint) || 0
        };
        message_server(msg);
    });

    [kpInput, kiInput, kdInput].forEach(input => {
        input.addEventListener("change", () => {
            const msg = {
                type: "set_pid",
                kP: parseFloat(kpInput.value) || 0,
                kI: parseFloat(kiInput.value) || 0,
                kD: parseFloat(kdInput.value) || 0,
            };
            message_server(msg);
        });
    });
    
    // init chartjs & chart
    initChart();
});
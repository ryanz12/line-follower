#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <QTRSensors.h>

const char* ssid = "Clanker line bot";
const char* password = "123456789";

enum State {OFF, ON};
enum State robotState = OFF;

const int motorLeft1 = 27;
const int motorLeft2 = 14;
const int motorRight1 = 12;
const int motorRight2 = 13;

const int ENA = 25;
const int ENB = 26;

QTRSensors qtr;
const u_int8_t sensorCount = 8;
u_int16_t sensorValues[sensorCount];

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

IPAddress IP_addr;

void initLittleFS(){
    if(!LittleFS.begin(true)){
        Serial.println("Error mounting LittleFS");
    }
    Serial.println("Mounted LittleFS");
}

void initWifi(){
    WiFi.softAP(ssid, password);

    IP_addr = WiFi.softAPIP();
    Serial.println(IP_addr);
}

void broadcastState(){
    ws.textAll("{\"state\":\"" + String(robotState) + "\"}");
}

void handleWebSocketMessage(void *arg, u_int8_t *data, size_t len){
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT){
        data[len] = 0;
        String message = (char*)data;

        if (message == "STATE"){
            broadcastState();
        }
        else if (message == "TOGGLE"){
            robotState = (robotState == ON) ? OFF : ON;
            broadcastState();
        }
    }
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, u_int8_t *data, size_t len){
    switch (type){
        case WS_EVT_CONNECT:
            Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
            break;
        case WS_EVT_DISCONNECT:
            Serial.printf("WebSocket client #%u disconnected\n", client->id());
            break;
        case WS_EVT_DATA:
            handleWebSocketMessage(arg, data, len);
            break;
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

void initWebSocket(){
    ws.onEvent(onEvent);
    server.addHandler(&ws);
}

void initQTR(){
    qtr.setTypeRC();
    qtr.setSensorPins((const uint8_t[]){4, 16, 17, 5, 18, 19, 21, 22}, sensorCount);

    digitalWrite(LED_BUILTIN, HIGH);
    for(uint16_t i=0; i<400; i++){
        qtr.calibrate();
        delay(5);
    }
    digitalWrite(LED_BUILTIN, LOW);
}

void setup() {
    Serial.begin(115200);

    initLittleFS();
    initWifi();
    initWebSocket();

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(LittleFS, "/index.html", "text/html");
    });

    server.serveStatic("/", LittleFS, "/");

    server.begin();

    pinMode(LED_BUILTIN, OUTPUT);

    initQTR();
}

void loop() {
    ws.cleanupClients();

    if (robotState == ON){
        static unsigned long lastSend = 0;
        if (millis() - lastSend > 100) {

            uint16_t position = qtr.readLineWhite(sensorValues);

            String json = "{\"position\":" + String(position) + ",";
            json += "\"sensors\":[";

            for (uint8_t i = 0; i < sensorCount; i++) {
                json += String(sensorValues[i]);
                if (i < sensorCount - 1) json += ",";
            }

            json += "]}";

            ws.textAll(json);

            lastSend = millis();
        }
    }
}

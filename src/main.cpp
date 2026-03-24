#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>

const char* ssid = "Clanker";
const char* password = "pr1234";

bool ledState = 0;
const int ledPin = 27;

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

void handleWebSocketMessage(void *arg, u_int8_t *data, size_t len){
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT){
        data[len] = 0;
        String message = (char*)data;

        if (message == "START"){
            ledState = 1;
        }
        else if (message == "STOP"){
            ledState = 0;
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

void setup() {
    Serial.begin(115200);

    pinMode(ledPin, OUTPUT);
    digitalWrite(ledPin, LOW);

    initLittleFS();
    initWifi();
    initWebSocket();

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(LittleFS, "/index.html", "text/html");
    });

    server.serveStatic("/", LittleFS, "/");

    server.begin();
}

void loop() {

    if (ledState){
        digitalWrite(ledPin, HIGH);
    }
    else {
        digitalWrite(ledPin, LOW);
    }
}

#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <QTRSensors.h>
#include <ArduinoJson.h>

const char* ssid = "Clanker line bot";
const char* password = "123456789";

enum State {OFF, ON, RECAL};
enum State robotState = OFF;

const int motorLeft1 = 25;
const int motorLeft2 = 26;
const int motorRight1 = 27;
const int motorRight2 = 13;

int speed = 100;
int feedforward = 3500;

float kP = 0;
float kI = 0;
float kD = 0;

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

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, message);
        
        if (error){
            ws.textAll("Error parsing JSON string");
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            return;
        }

        const char* type = doc["type"] | "";
        if (strcmp(type, "request_state") == 0){
            broadcastState();
        }
        else if(strcmp(type, "request_toggle") == 0){
            robotState = (robotState == ON) ? OFF : ON;
            broadcastState();
        }
        else if (strcmp(type, "request_recalibrate") == 0){
            robotState = RECAL;
            broadcastState();
        }
        else if (strcmp(type, "request_change_speed") == 0){
            speed = doc["speed"];
            Serial.println(speed);
        }
        else if (strcmp(type, "set_pid") == 0){
            kP = doc["kP"];
            kI = doc["kI"];
            kD = doc["kD"];
            Serial.println(kP);
            Serial.println(kI);
            Serial.println(kD);
        }
        else if (strcmp(type, "set_ff") == 0){
            feedforward = doc["ff"];
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

void driveForward(){
    analogWrite(motorLeft1, speed);
    digitalWrite(motorLeft2, LOW);

    analogWrite(motorRight1, speed);
    digitalWrite(motorRight2, LOW);
}

void resetMotors(){
    digitalWrite(motorLeft1, LOW);
    digitalWrite(motorLeft2, LOW);
    digitalWrite(motorRight1, LOW);
    digitalWrite(motorRight2, LOW);
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
    Serial.println(WiFi.softAPIP());
}

void loop() {
    ws.cleanupClients();

    if (robotState == ON){
        uint16_t position = qtr.readLineBlack(sensorValues);
        int error = feedforward - position;

        // send to client every 100ms
        static unsigned long lastSend = 0;
        if (millis() - lastSend > 100) {

            String json = "{\"type\":\"sensors\",";
            json += "\"position\":" + String(position) + ",";
            json += "\"error\":" + String(error) + ",";
            json += "\"sensors\":[";

            for (uint8_t i = 0; i < sensorCount; i++) {
                json += String(sensorValues[i]);
                if (i < sensorCount - 1) json += ",";
                Serial.print(sensorValues[i]);
                Serial.print('\t');
            }
            Serial.println(position);

            json += "]}";

            ws.textAll(json);

            lastSend = millis();
        }

        driveForward();
    }
    else if (robotState == RECAL){
        initQTR();
        robotState = ON;
        broadcastState();
    }
    else if (robotState == OFF){
        resetMotors();
    }
}
const statusDiv = document.getElementById('status');
const pollingStatusDiv = document.getElementById('pollingStatus');
const pollingStartButton = document.getElementById('pollingStartButton');
const pollingStopButton = document.getElementById('pollingStopButton');
const pollingCountInput = document.getElementById('pollingCount')
const pollingList = document.getElementById('pollingList')

const userAgentID = navigator.userAgent + "_" + new Date().getTime();
const encoder = new TextEncoder();

const brokerUrl = "wss://m8f92daf.ala.asia-southeast1.emqxsl.com:8084/mqtt"
const topicRoot = "player/telemetry/"

// ポーリングの間隔[ms]
const pollingInterval = 1000

// バッテリー状態
const batteryStatusMap = {
    "0": "Unknown",
    "1": "Charging",
    "2": "Discharging",
    "3": "NotCharging",
    "4": "Full"
};

// 熱状態
const thermalStatusMap = {
    "-1": "Unknown",
    "0": "Nominal",
    "1": "Fair",
    "2": "Serious",
    "3": "Critical"
};

// プレイヤー数
let playerCount;
// プレイヤー情報一覧
const players = {}

// MQTTクライアント本体
const client = new Paho.MQTT.Client(brokerUrl, userAgentID);

client.onConnectionLost = onConnectionLost;
client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
    userName: "tyffon_mirrorge",
    password: "tyffon1111",
});

// 接続完了時
function onConnect() {
    console.log("Connected to MQTT broker");
    statusDiv.innerHTML = "Connected to MQTT broker";
}

// 接続失敗時
function onFailure(responseObject) {
    console.log("Failed to connect to MQTT broker: " + responseObject.errorMessage);
    statusDiv.innerHTML = "Failed to connect to MQTT broker: " + responseObject.errorMessage;
}

// 切断時
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("Connection lost: " + responseObject.errorMessage);
        statusDiv.innerHTML = "Connection lost: " + responseObject.errorMessage;
    }
}

// メッセージの送信
function publishMessage(topic, payload) {
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    client.send(message);
    // console.log(`Message published: Topic: ${topic}, Payload: ${payload}`)
}

// メッセージポーリング用
let pollingPublishMessage = null;

// ポーリング開始
function startPolling() {
    // ボタン状態を切り替え
    pollingStatusDiv.innerHTML = "Polling Started";
    pollingStartButton.disabled = !pollingStartButton.disabled;
    pollingStopButton.disabled = !pollingStopButton.disabled;
    // 情報生成
    playerCount = parseInt(pollingCountInput.value);
    createPollingInfo(playerCount);
    // メッセージ呼び出し開始
    publishDeviceMessage();
}

// ポーリング終了
function stopPolling() {
    // メッセージ呼び出しを停止
    clearTimeout(pollingPublishMessage);
    pollingPublishMessage = null;
    // 情報を削除
    Object.keys(players).forEach(key => {
        pollingList.removeChild(pollingList.querySelector(`#${key}`));
        delete players[key];
    })
    // ボタン状態を切り替え
    pollingStartButton.disabled = !pollingStartButton.disabled;
    pollingStopButton.disabled = !pollingStopButton.disabled;
    pollingStatusDiv.innerHTML = "Polling Stopped.";
}

// ポーリング情報を作成
function createPollingInfo(count) {
    for (let i = 1; i < count + 1; i++) {
        const uid = `uid${i}`;

        // デバイス情報を作成
        const batteryLevel = Math.random();
        const batteryStatus = Math.floor(Math.random() * 4) + 1;
        const thermal = Math.floor(Math.random() * 4);
        const deviceInfo = createDeviceInfo(batteryLevel, batteryStatus, thermal, "Test Vision Pro", `Test ${i}`, uid, "MacOS");
        const gameInfo = createGameInfo();
        // 位置情報を作成
        const posX = (Math.random() - 0.5) * 200.0;
        const posY = (Math.random() - 0.5) * 100.0;
        const angle = Math.random() * 360;
        players[uid] = { posX, posY, angle, deviceInfo, gameInfo };

        // リストに要素を追加
        const itemHeader = document.createElement('h3');
        itemHeader.innerText = `Player ${i}`;

        const itemBody = document.createElement('dl');
        itemBody.innerHTML = createListItemBodyHtml(uid);

        const listItem = document.createElement('li');
        listItem.id = uid;
        listItem.appendChild(itemHeader);
        listItem.appendChild(itemBody);

        // リスト項目を追加
        pollingList.appendChild(listItem);
    }
}

// メッセージの作成
function publishDeviceMessage() {
    // メッセージ送信処理
    Object.keys(players).forEach(key => {
        // トピック作成
        const topic = topicRoot + key;
        const player = players[key];

        // ランダム移動
        const diffX = (Math.random() - 0.5) * 10.0;
        const diffY = (Math.random() - 0.5) * 10.0;
        const diffAngle = Math.atan2(diffX, diffY) * 180 / Math.PI;
        player.posX += diffX;
        player.posY += diffY;
        player.angle = diffAngle;

        // ペイロードを作成
        const payload = createPayloadBytes(player.posX, player.posY, player.angle, player.deviceInfo, player.gameInfo);
        publishMessage(topic, payload);

        // 表示情報を更新
        const listItem = pollingList.querySelector(`#${key}`);
        const itemBody = listItem.querySelector('dl');
        itemBody.innerHTML = createListItemBodyHtml(key);
    });
    // 次のメッセージ送信をスケジュール
    pollingPublishMessage = setTimeout(publishDeviceMessage, pollingInterval);
}

// リスト項目の中身を作成
function createListItemBodyHtml(uid) {
    const player = players[uid];
    let bodyHtml = `<dt>Position</dt><dd>(${player.posX}, ${player.posY})</dd>`
    bodyHtml += `<dt>Angle</dt><dd>${player.angle}</dd>`;
    bodyHtml += `<dt>Device Model</dt><dd>${player.deviceInfo.deviceModel}</dd>`;
    bodyHtml += `<dt>Device Name</dt><dd>${player.deviceInfo.deviceName}</dd>`;
    bodyHtml += `<dt>Device ID</dt><dd>${player.deviceInfo.deviceUniqueIdentifier}</dd>`;
    bodyHtml += `<dt>OS</dt><dd>${player.deviceInfo.operatingSystem}</dd>`;
    bodyHtml += `<dt>Battery Level</dt><dd>${(player.deviceInfo.batteryLevel * 100).toFixed(0)}%</dd>`;
    bodyHtml += `<dt>Battery Status</dt><dd>${batteryStatusMap[player.deviceInfo.batteryStatus]}</dd>`;
    bodyHtml += `<dt>Thermal Status</dt><dd>${thermalStatusMap[player.deviceInfo.thermalStatus]}</dd>`;
    return bodyHtml;
}

// デバイス情報の作成
function createDeviceInfo(batteryLevel, batteryStatus, thermalStatus, model, name, uid, os) {
    return {
        batteryLevel: batteryLevel,
        batteryStatus: batteryStatus,
        thermalStatus: thermalStatus,
        deviceModel: model,
        deviceName: name,
        deviceUniqueIdentifier: uid,
        operatingSystem: os
    }
}

function createGameInfo() {
    return {
        status: "Playing",
        time: 0,
    }
}

// 位置情報のJSONの作成
function createPayloadBytes(posX, posY, angle, deviceInfo, gameInfo) {
    const telemetry = {
        posX: posX,
        posY: posY,
        angle: angle,
        deviceInfo: deviceInfo,
        gameInfo: gameInfo,
    };
    const jsonString = JSON.stringify(telemetry)
    return encoder.encode(jsonString)
}
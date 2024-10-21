const deviceLabels = {
    "E92A520C-C082-44B8-8BD2-B1723C6C1ED6": "MO-001",
    "E6EDA704-2DFC-4C33-9567-5788033A51D5": "MO-002",
    "943584F6-2410-40D4-83B2-48E0386CA6B5": "MO-003",
    "FCC139EF-6FB9-4117-B430-28454952408B": "MO-004",
    "5E2601E1-6B74-4315-B2B1-4D347919BEBC": "MO-005",
    "B3E73B5A-8642-46B8-8254-77B01EC2E882": "MO-006",
    "07B6DA2E-BE1E-478B-B83B-8CA59036ADDB": "MO-007",
    "46D22DCA-F23C-4F69-B14B-03BCFADF995E": "MO-008",
    "DEA2677A-363A-4A9E-97A0-F7F3043CADCE": "MO-009",
    "98374C30-9BE2-42BF-A86C-290C363642E4": "MO-010",
    "23C8610F-F4F1-44A9-9472-834ABF8566C9": "MO-011",
    "7137F56A-4A21-49B2-BFD4-A990A145C964": "MO-012",
    "9D9D3FE6-BFA6-4639-90B6-23463E69DAFC": "MO-013",
    "80787FFE-5C6F-4A9F-92C1-F15C2EA8DCFD": "MO-014",
    "7EAAD652-BB65-4941-9C3F-B8E75189E253": "MO-015",
    "4B275030-16EF-46FD-8E4D-9421D89A0AAF": "MO-016",
    "B3D78251-663E-44D4-B95A-3CF1DCC83A62": "MO-017",
    "A8F2328B-2F29-44CE-8838-67BFD0C18890": "MO-018",
    "042F7F95-AE29-4ACF-A174-13270C1B0ACD": "MO-019",
    "BBC86D95-C306-493B-AECE-D012539F92FC": "MO-020",
};

const statusDiv = document.getElementById('status');
const coordinatesDiv = document.getElementById('coordinates');
const deviceList = document.getElementById('deviceList');
const map = document.getElementById('map');
const mapContainer = document.getElementById('mapContainer');
const popup = document.getElementById('popup');
const deviceInfoDiv = document.getElementById('deviceInfo');
const saveLogButton = document.getElementById('saveLogButton');
const saveLogAllButton = document.getElementById('saveLogAllButton');
const forceStopButton = document.getElementById('forceStopButton');
const mapInfoDiv = document.getElementById('mapInfo');

// MQTTブローカーのURL
const mqttBrokerUrl = "wss://a942597f.ala.asia-southeast1.emqxsl.com:8084/mqtt";
const subscribeTopic = "player/telemetry/#";
const posScaleX = 4.4;
const posScaleY = -4.4;
const posOffsetX = 62;
const posOffsetY = 66;
const rotOffsetY = -120;
const mqttBrokerID = "tyffon_mirrorge";
const mqttBrokerPW = "tyffon1111";
const userAgentID = navigator.userAgent + "_" + new Date().getTime();

// deviceLabelsの最後の3桁を取得する関数
function getLastThreeDigits(label) {
    // ラベル内の数字部分（1つ以上の連続した数字）を探す
    const match = label.match(/\d+/);
    if (match) {
        // 見つかった数字から先頭の0を除去して返す
        return parseInt(match[0], 10).toString(); // 数字を整数としてパースしてから文字列に変換
    }
    return ""; // 数字が見つからない場合は"未定義"
}

function getSequenceName(seconds) {
    if (seconds <= 0) {
        return "カートタッチ前";
    } else if (seconds <= 145) {
        return "チュートリアル";
    } else if (seconds <= 380) {
        return "フリーローム";
    } else if (seconds >= 370 && seconds <= 389) {
        return "魔法陣待機中";
    } else if(seconds <= 490) {
        return "ドラゴン襲来";
    } else if(seconds <= 700) {
        return "ドラゴン戦";
    } else if(seconds < 900) {
        return "エンディング";
    } else if (seconds <= 1500) {
        return "体験終了";
    }

    return "不明なシーケンス";
}

// バッテリー状態マップ
const batteryStatusMap = {
    "0": "不明",
    "1": "充電中",
    "2": "放電中",
    "3": "充電していません",
    "4": "満充電"
};

// 温度状態マップ
const thermalStatusMap = {
    "-1": "不明",
    "0": "正常",
    "1": "やや注意",
    "2": "注意（不安定）",
    "3": "危険（停止の恐れ）"
};

// ビューポートのサイズ
let viewportOriginWidth = 0;
let viewportOriginHeight = 0;
let viewportWidth = 0;
let viewportHeight = 0;

let isDragging = false;
let startX, startY;

let mapX = 0, mapY = 0;
let scale = 1;

const players = {};
const timeoutTimers = {};
let playerCount = 0;
const logData = {};

// 選択されたユーザーID
let selectedUserId = null;

document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

document.addEventListener('gesturechange', function (e) {
    e.preventDefault();
});

document.addEventListener('gestureend', function (e) {
    e.preventDefault();
});

document.addEventListener('touchmove', function (e) {
    if (e.scale !== 1) {
        e.preventDefault();
    }
}, { passive: false });


// ウィンドウロード時の処理
window.addEventListener('load', () => {
    viewportWidthOrigin = window.innerWidth;
    viewportHeightOrigin = window.innerHeight;
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
});

// ビューポートのサイズ変更時の処理
window.addEventListener('resize', () => {
    const diffX = window.innerWidth - viewportWidth;
    const diffY = window.innerHeight - viewportHeight;
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    Object.keys(players).forEach(key => {
        // ピクセルベースの座標調整
        const player = players[key];
        player.x += diffX / 2;
        player.y += diffY / 2;
        // マーカー座標の更新
        const marker = player.marker;
        marker.style.left = `${player.x}px`;
        marker.style.top = `${player.y}px`;
    });
});

// マップ上でマウスボタン押下時の処理
map.addEventListener('mousedown', (e) => {
    return;
    isDragging = true;
    startX = e.clientX - mapX;
    startY = e.clientY - mapY;
    map.style.cursor = 'グラビング';
});

// マップ上でマウス移動時の処理
map.addEventListener('mousemove', (e) => {
    return;
    if (isDragging) {
        mapX = e.clientX - startX;
        mapY = e.clientY - startY;
        changeMapTransform();
    }
});

// マップ上でマウスボタンを離したときの処理
map.addEventListener('mouseup', () => {
    return;
    isDragging = false;
    map.style.cursor = 'グラブ';
});

// マップ上でマウスホイールを使用したときの処理
map.addEventListener('wheel', (e) => {
    return;
    e.preventDefault();
    const scaleAmount = 0.1;
    scale += e.deltaY > 0 ? -scaleAmount : scaleAmount;
    scale = Math.min(Math.max(0.5, scale), 5);
    changeMapTransform();
});

// マップの変形を更新する関数
function changeMapTransform() {
    map.style.transform = `translate(${mapX}px, ${mapY}px) scale(${scale})`;
}

// MQTTクライアントのインスタンス生成
const client = new Paho.MQTT.Client(mqttBrokerUrl, userAgentID);

client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;
client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
    userName: mqttBrokerID,
    password: mqttBrokerPW,
});

// メッセージ送信関数
function publishMessage(topic, payload) {
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    client.send(message);
    console.log(`メッセージ送信: トピック: ${topic}, ペイロード: ${payload}`);
}

// 接続成功時の処理
function onConnect() {
    console.log("管理サーバーに接続しました");
    statusDiv.innerHTML = "管理サーバーに接続しました";
    client.subscribe(subscribeTopic);
}

// 接続失敗時の処理
function onFailure(responseObject) {
    console.log("管理サーバーへの接続に失敗しました: " + responseObject.errorMessage);
    statusDiv.innerHTML = "管理サーバーへの接続に失敗しました: " + responseObject.errorMessage;
}

// 接続切断時の処理
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("接続が失われました: " + responseObject.errorMessage);
        statusDiv.innerHTML = "接続が失われました: " + responseObject.errorMessage;
        // 再接続を試みる
        attemptReconnect();
    }
}

// 再接続を試みる関数
function attemptReconnect() {
    console.log("再接続を試みています...");
    statusDiv.innerHTML = "再接続を試みています...";
    client.connect({
        onSuccess: onConnect,
        onFailure: function (responseObject) {
            console.log("再接続に失敗しました: " + responseObject.errorMessage);
            statusDiv.innerHTML = "再接続に失敗しました: " + responseObject.errorMessage;
            // 再試行までの待機時間
            setTimeout(attemptReconnect, 5000);
        },
        userName: mqttBrokerID,
        password: mqttBrokerPW,
    });
}

// メッセージ到着時の処理
function onMessageArrived(message) {
    const topic = message.destinationName;
    const telemetry = JSON.parse(message.payloadString);
     // `deviceUniqueIdentifier`を`userId`として使用
    const userId = telemetry.deviceInfo.deviceUniqueIdentifier;

    if (!(userId in deviceLabels)) {
    //    return;
    }

    // プレイヤーのタイムアウトタイマーをリセットまたは開始
    resetTimeoutTimer(userId);

    const timestamp = new Date().toISOString();
    if (!logData[userId]) {
        logData[userId] = [];
    }
    logData[userId].push(`[${timestamp}] トピック: ${topic}, メッセージ: ${message.payloadString}`);

const rawX = (telemetry.posX * posScaleX) + posOffsetX;
const rawY = (telemetry.posY * posScaleY) + posOffsetY;
const rotated = applyRotationOffset(rawX, rawY, rotOffsetY, posOffsetX, posOffsetY);
const x = rotated.x;
const y = rotated.y;
const rotation = telemetry.angle + rotOffsetY;

if (!players[userId]) {
    playerCount++;
    updatePlayerCountUI();

    // マップにマーカーを追加
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

        // プレイヤー番号をマーカーに追加
        const label = deviceLabels[telemetry.deviceInfo.deviceUniqueIdentifier] || `Unknown`;
        const playerNumber = document.createElement('div');
        playerNumber.className = 'player-number';
        playerNumber.innerText = getLastThreeDigits(label);
        marker.appendChild(playerNumber);
        playerNumber.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;

        // アイコンとimgタグを挿入
        const icon = document.createElement('img');
        icon.src = 'player.png';
        icon.className = 'player-icon';
        marker.appendChild(icon);

        // マーカークリック時の処理
        marker.addEventListener('click', () => {
            onSelectDevice(userId, telemetry.deviceInfo);
            scrollSelectItem(userId);
        });
        map.appendChild(marker);

        // リストにデバイス情報を追加
        const listItem = createListItem(playerCount, telemetry.deviceInfo, telemetry.gameInfo);
        // リストアイテムのクリック処理
        listItem.addEventListener('click', () => {
            onSelectDevice(userId, telemetry.deviceInfo);
        });
        deviceList.appendChild(listItem);

        // プレイヤー情報を更新
        players[userId] = { number: playerCount, marker, listItem, x, y, rotation, deviceInfo: telemetry.deviceInfo, appVersion: telemetry.appVersion };
    } else {
        // 既存プレイヤーの情報を更新
        const marker = players[userId].marker;
        animateMarker(marker, players[userId], { x, y, rotation });
        const listItem = players[userId].listItem;
        updateListItem(listItem, telemetry.deviceInfo, telemetry.gameInfo);
        players[userId] = { number: players[userId].number, marker, listItem, x, y, rotation, deviceInfo: telemetry.deviceInfo, appVersion: telemetry.appVersion  };
    }

    // 現在のユーザーのデバイス情報を表示
    if (popup.style.display === 'block' && selectedUserId === userId) {
        showDeviceInfo(players[userId]);
    }
}

// マーカークリック時のリスト
function onSelectDevice(userId) {
    selectedUserId = userId;
    changeSelectPlayer();
    showDeviceInfo(players[userId]);
}

// プレイヤー選択時のUI更新
function changeSelectPlayer() {
    Object.keys(players).forEach(key => {
        players[key].marker.classList.remove('selected');
        players[key].listItem.classList.remove('selected');
    });
    players[selectedUserId].marker.classList.add('selected');
    players[selectedUserId].listItem.classList.add('selected');
    //focusPlayerMarker(selectedUserId);
}

// 選択したアイテムまでスクロール
function scrollSelectItem(userId) {
    const itemRect = players[userId].listItem.getBoundingClientRect();
    const containerRect = deviceList.getBoundingClientRect();
    const scrollTo = itemRect.top - containerRect.top + deviceList.scrollTop;
    deviceList.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
    });
}

// 選択したマーカーを中央に表示
function focusPlayerMarker(userId) {
    const marker = players[userId].marker;
    // マップの中央
    const mapRect = map.getBoundingClientRect();
    const mapCenterX = mapRect.left + mapRect.width / 2;
    const mapCenterY = mapRect.top + mapRect.height / 2;
    // マーカーの中央
    const markerRect = marker.getBoundingClientRect();
    const markerCenterX = markerRect.left + markerRect.width / 2;
    const markerCenterY = markerRect.top + markerRect.height / 2;
    // 座標の計算
    mapX = Math.floor(mapCenterX - markerCenterX);
    mapY = Math.floor(mapCenterY - markerCenterY);

    changeMapTransform();
}

// タイムアウトタイマーのリセット
function resetTimeoutTimer(userId) {
    if (timeoutTimers[userId]) {
        clearTimeout(timeoutTimers[userId]);
    }
    timeoutTimers[userId] = setTimeout(() => {
        removePlayer(userId);
    }, 20000); // 10秒
}

// プレイヤーの削除
function removePlayer(userId) {
    if (players[userId]) {
        deviceList.removeChild(players[userId].listItem);
        map.removeChild(players[userId].marker);
        delete players[userId];
        delete logData[userId];
        delete timeoutTimers[userId];
        playerCount--;
        updatePlayerCountUI();
    }
}

// 角度の正規化
function normalizeAngle(angle) {
    return ((angle + 180) % 360 + 360) % 360 - 180;
}

// マーカーのアニメーション
function animateMarker(marker, from, to, duration = 1000) {
    const startTime = performance.now();
    const playerNumber = marker.querySelector('.player-number');

    function animate(time) {
        const elapsed = time - startTime;
        const t = Math.min(elapsed / duration, 1);
        const newX = from.x + (to.x - from.x) * t;
        const newY = from.y + (to.y - from.y) * t;

        const angleDiff = normalizeAngle(to.rotation - from.rotation);
        const newRotation = from.rotation + angleDiff * t;

        marker.style.left = `${newX}%`;
        marker.style.top = `${newY}%`;
        marker.style.transform = `translate(-50%, -50%) rotate(${newRotation}deg)`;
        
        if (playerNumber) {
            playerNumber.style.transform = `translate(-50%, -50%) rotate(${-newRotation}deg)`;
        }


        if (t < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

// リストアイテムの生成
function createListItem(playerCount, deviceInfo, gameInfo) {
    const itemHeader = document.createElement('h3');
    let labelName = deviceLabels[deviceInfo.deviceUniqueIdentifier] || `Unknown ${playerCount}`;
    itemHeader.innerHTML = labelName;

    const itemBody = document.createElement('dl');
    itemBody.classList.add("definition-list");
    itemBody.innerHTML = createListItemHtml(deviceInfo, gameInfo);

    const listItem = document.createElement('li');
    listItem.classList.add('information');
    listItem.appendChild(itemHeader);
    listItem.appendChild(itemBody);

    return listItem;
}

// リストアイテムの更新
function updateListItem(listItem, deviceInfo, gameInfo) {
    const itemBody = listItem.querySelector(".definition-list");
    itemBody.innerHTML = createListItemHtml(deviceInfo, gameInfo);
}

// リストアイテムのHTML生成
function createListItemHtml(deviceInfo, gameInfo) {
    const sequenceName = getSequenceName(gameInfo.time);
    let itemText = `<div class="no-indent">タイムライン${formatTime(gameInfo.time)}</dd><div class="no-indent">${sequenceName}</dd>`;
    itemText += `<div class="no-indent">バッテリー ${(deviceInfo.batteryLevel * 100).toFixed(0)}%</dd>`;
    //itemText += `<dt>温度状態</dt><dd>${thermalStatusMap[deviceInfo.thermalStatus]}</dd>`;
    return itemText;
}

// プレイヤー数UIの更新
function updatePlayerCountUI() {
    coordinatesDiv.innerHTML = `接続中デバイス: ${playerCount}`;
}

// デバイス情報の表示
function showDeviceInfo(player) {
    const deviceInfo = player.deviceInfo;
    // ヘッダー部分
    const header = popup.querySelector("h2");
    const labelName = deviceLabels[deviceInfo.deviceUniqueIdentifier] || `Unknown ${player.number} Info`;
    header.innerHTML = labelName;

    // 本文部分
    const body = deviceInfoDiv.querySelector(".definition-list");
    let info = `<dt>デバイスモデル</dt><dd>${deviceInfo.deviceModel}</dd>`;
    info += `<dt>デバイス名</dt><dd>${deviceInfo.deviceName}</dd>`;
    info += `<dt>デバイスID</dt><dd>${deviceInfo.deviceUniqueIdentifier}</dd>`;
    info += `<dt>OS</dt><dd>${deviceInfo.operatingSystem}</dd>`;
    info += `<dt>バッテリーレベル</dt><dd>${(deviceInfo.batteryLevel * 100).toFixed(0)}%</dd>`;
    info += `<dt>バッテリー状態</dt><dd>${batteryStatusMap[deviceInfo.batteryStatus]}</dd>`;
    info += `<dt>温度状態</dt><dd>${thermalStatusMap[deviceInfo.thermalStatus]}</dd>`;
    info += `<dt>アプリバージョン</dt><dd>${player.appVersion}</dd>`;
    body.innerHTML = info;

    popup.style.display = 'block';
}

// ポップアップクローズ時の処理
popup.addEventListener('click', () => {
    popup.style.display = 'none';
    selectedUserId = null;
});

// すべてのログ保存ボタンクリック時の処理
saveLogAllButton.addEventListener('click', saveLogToFileAll);

// ログ保存ボタンクリック時の処理
saveLogButton.addEventListener('click', () => {
    const saveTime = new Date();
    const saveTimeString = saveTime.toISOString().replace(/[:.]/g, '-');
    saveLogToFile(selectedUserId, saveTimeString);
});

// すべてのユーザーのログを保存
function saveLogToFileAll() {
    const saveTime = new Date();
    const saveTimeString = saveTime.toISOString().replace(/[:.]/g, '-');
    
    Object.keys(logData).forEach(userId => {
        saveLogToFile(userId, saveTimeString);
    });
}

// 指定したユーザーのログを保存
function saveLogToFile(userId, timeString) {
    const logContent = logData[userId].join('\n');
    const logFileName = `mqtt_log_${userId}_${timeString}.txt`;
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFileName;
    a.click();
    URL.revokeObjectURL(url);
}

// 強制停止ボタンクリック時の処理
forceStopButton.addEventListener('click', () => {
    publishStopSignal(selectedUserId);
});

// 強制停止信号をMQTTで送信
function publishStopSignal(userId) {
    console.log(`プレイヤー ${userId} を停止しました。`);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// 回転を適用する関数
function applyRotationOffset(x, y, angle, centerX, centerY) {
    const radians = angle * Math.PI / 180; // 角度をラジアンに変換
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const dx = x - centerX;
    const dy = y - centerY;

    const rotatedX = cos * dx - sin * dy + centerX;
    const rotatedY = sin * dx + cos * dy + centerY;

    return { x: rotatedX, y: rotatedY };
}
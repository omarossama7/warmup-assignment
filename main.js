const fs = require("fs");

// ---------- Helper functions ----------

function time12ToSeconds(time) {
    time = time.trim();
    let [clock, period] = time.split(" ");
    let [h, m, s] = clock.split(":").map(Number);

    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;

    return h * 3600 + m * 60 + s;
}

function timeToSeconds(time) {
    let [h, m, s] = time.split(":").map(Number);
    return h * 3600 + m * 60 + s;
}

function secondsToTime(sec) {
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = sec % 60;

    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ============================================================
// Function 1
// ============================================================
function getShiftDuration(startTime, endTime) {

    let start = time12ToSeconds(startTime);
    let end = time12ToSeconds(endTime);

    return secondsToTime(end - start);
}

// ============================================================
// Function 2
// ============================================================
function getIdleTime(startTime, endTime) {

    let start = time12ToSeconds(startTime);
    let end = time12ToSeconds(endTime);

    let startDelivery = 8 * 3600;
    let endDelivery = 22 * 3600;

    let idle = 0;

    if (start < startDelivery)
        idle += Math.min(end, startDelivery) - start;

    if (end > endDelivery)
        idle += end - Math.max(start, endDelivery);

    if (idle < 0) idle = 0;

    return secondsToTime(idle);
}

// ============================================================
// Function 3
// ============================================================
function getActiveTime(shiftDuration, idleTime) {

    let shift = timeToSeconds(shiftDuration);
    let idle = timeToSeconds(idleTime);

    return secondsToTime(shift - idle);
}

// ============================================================
// Function 4
// ============================================================
function metQuota(date, activeTime) {

    let active = timeToSeconds(activeTime);

    let normalQuota = 8*3600 + 24*60;
    let eidQuota = 6*3600;

    let d = new Date(date);
    let eidStart = new Date("2025-04-10");
    let eidEnd = new Date("2025-04-30");

    let quota = (d >= eidStart && d <= eidEnd) ? eidQuota : normalQuota;

    return active >= quota;
}

// ============================================================
// Function 5
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    let data = fs.readFileSync(textFile,"utf8").trim();
    let rows = data ? data.split("\n") : [];

    for (let row of rows) {
        let cols = row.split(",");
        if (cols[0] === shiftObj.driverID && cols[2] === shiftObj.date)
            return {};
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quota = metQuota(shiftObj.date, activeTime);

    let newLine =
        `${shiftObj.driverID},${shiftObj.driverName},${shiftObj.date},${shiftObj.startTime},${shiftObj.endTime},${shiftDuration},${idleTime},${activeTime},${quota},false`;

    let insertIndex = rows.length;

    for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].split(",")[0] === shiftObj.driverID) {
            insertIndex = i + 1;
            break;
        }
    }

    rows.splice(insertIndex,0,newLine);

    fs.writeFileSync(textFile, rows.join("\n"));

    return {
        ...shiftObj,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota: quota,
        hasBonus: false
    };
}


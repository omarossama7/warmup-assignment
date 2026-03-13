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

// ============================================================
// Function 6
// ============================================================
function setBonus(textFile, driverID, date, newValue) {

    let rows = fs.readFileSync(textFile,"utf8").trim().split("\n");

    for (let i=0;i<rows.length;i++) {

        let cols = rows[i].split(",");

        if (cols[0] === driverID && cols[2] === date) {

            cols[9] = String(newValue);
            rows[i] = cols.join(",");
        }
    }

    fs.writeFileSync(textFile, rows.join("\n"));
}

// ============================================================
// Function 7
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {

    let rows = fs.readFileSync(textFile,"utf8").trim().split("\n");

    let exists=false;
    let count=0;

    for (let row of rows){

        let cols=row.split(",");

        if(cols[0]===driverID){

            exists=true;

            let m=Number(cols[2].split("-")[1]);

            if(m===Number(month) && cols[9]==="true")
                count++;
        }
    }

    return exists ? count : -1;
}

// ============================================================
// Function 8
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {

    let rows=fs.readFileSync(textFile,"utf8").trim().split("\n");

    let total=0;

    for(let row of rows){

        let cols=row.split(",");

        if(cols[0]===driverID){

            let m=Number(cols[2].split("-")[1]);

            if(m===Number(month))
                total+=timeToSeconds(cols[7]);
        }
    }

    return secondsToTime(total);
}

// ============================================================
// Function 9
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    let rows=fs.readFileSync(textFile,"utf8").trim().split("\n");
    let rates=fs.readFileSync(rateFile,"utf8").trim().split("\n");

    let dayOff="";

    for(let r of rates){
        let cols=r.split(",");
        if(cols[0]===driverID)
            dayOff=cols[1];
    }

    let total=0;

    for(let row of rows){

        let cols=row.split(",");

        if(cols[0]!==driverID) continue;

        let date=cols[2];
        let m=Number(date.split("-")[1]);

        if(m!==Number(month)) continue;

        let d=new Date(date);
        let weekday=d.toLocaleDateString("en-US",{weekday:"long"});

        if(weekday===dayOff) continue;

        let eidStart=new Date("2025-04-10");
        let eidEnd=new Date("2025-04-30");

        let quota=(d>=eidStart && d<=eidEnd)
            ? 6*3600
            : 8*3600 + 24*60;

        total+=quota;
    }

    total-=bonusCount*2*3600;

    if(total<0) total=0;

    return secondsToTime(total);
}

// ============================================================
// Function 10
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    let rates=fs.readFileSync(rateFile,"utf8").trim().split("\n");

    let basePay=0;
    let tier=0;

    for(let r of rates){

        let cols=r.split(",");

        if(cols[0]===driverID){
            basePay=Number(cols[2]);
            tier=Number(cols[3]);
        }
    }

    let allowed={1:50,2:20,3:10,4:3}[tier];

    let missing=timeToSeconds(requiredHours)-timeToSeconds(actualHours);

    if(missing<=0) return basePay;

    missing-=allowed*3600;

    if(missing<0) missing=0;

    let billable=Math.floor(missing/3600);

    let rate=Math.floor(basePay/185);

    return basePay - billable*rate;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
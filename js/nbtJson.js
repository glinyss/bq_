// A generic helper to navigate BQ JSON which uses key:type formats.

function getBQType(obj, keyBase) {
    if(!obj) return null;
    let typeKeys = Object.keys(obj).find(k => k.split(':')[0] === keyBase);
    return typeKeys || null;
}

function getBQValue(obj, keyBase) {
    let k = getBQType(obj, keyBase);
    return k ? obj[k] : undefined;
}

function setBQValue(obj, keyBase, value, defaultType) {
    let typeKeys = Object.keys(obj).find(k => k.split(':')[0] === keyBase);
    if(typeKeys) {
        obj[typeKeys] = value;
    } else {
        obj[`${keyBase}:${defaultType}`] = value;
    }
}

// Ensure arrays represented as objects with 0:10, 1:10 are iterable
function iterateBQArray(bqArrayObj, callback) {
    if(!bqArrayObj) return;
    Object.keys(bqArrayObj).forEach(key => {
        let index = parseInt(key.split(':')[0], 10);
        if(!isNaN(index)) {
            callback(bqArrayObj[key], index, key);
        }
    });
}

"use strict";

const build = require('./build.js');
const packageJson = require('../../package.json');
const {TRILIUM_DATA_DIR} = require('./data_dir.js');

const APP_DB_VERSION = 227;
const SYNC_VERSION = 31;
const CLIPPER_PROTOCOL_VERSION = "1.0";

module.exports = {
    appVersion: packageJson.version,
    dbVersion: APP_DB_VERSION,
    syncVersion: SYNC_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision,
    dataDirectory: TRILIUM_DATA_DIR,
    clipperProtocolVersion: CLIPPER_PROTOCOL_VERSION,
    utcDateTime: new Date().toISOString() // for timezone inference
};

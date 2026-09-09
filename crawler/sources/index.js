// sources/index.js — registra as fontes na ordem de prioridade (config.order).
const fgv = require("./fgv.js");
const fundatec = require("./fundatec.js");
const idecan = require("./idecan.js");
const ifpe = require("./ifpe.js");
const fcc = require("./fcc.js");
const ibade = require("./ibade.js");

const config = require("../config.js");

const byCode = { fgv, fundatec, idecan, ifpe, fcc, ibade };

module.exports = (config.order || Object.keys(byCode)).map((c) => byCode[c]).filter(Boolean);

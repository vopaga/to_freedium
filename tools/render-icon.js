"use strict";

/**
 * Rasterizes icons/icon.svg into icons/icon-128.png for the AMO listing.
 * Run with: node tools/render-icon.js
 * Requires @resvg/resvg-js as a devDependency (pure WASM, no native build).
 */

const fs = require("node:fs");
const path = require("node:path");

const { Resvg } = require("@resvg/resvg-js");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "icons", "icon.svg");
const pngPath = path.join(root, "icons", "icon-128.png");

const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 128 },
    background: "rgba(0, 0, 0, 0)",
});
const pngBuffer = resvg.render().asPng();
fs.writeFileSync(pngPath, pngBuffer);

console.log(`Wrote ${path.relative(root, pngPath)} (${pngBuffer.length} bytes)`);

// Reconstruye ../index.html a partir de los archivos de esta carpeta:  node src/build.js
const fs = require("fs"), path = require("path");
const d = __dirname, rd = f => fs.readFileSync(path.join(d, f), "utf8");
let out = rd("shell.html").split("/*MAPDATA*/").join(rd("map-data.js"));
out = out.split("/*APP*/").join(rd("catalogos.js") + "\n" + rd("externas.js") + "\n" + rd("vistas.js") + "\n" + rd("buscador.js") + "\n" + rd("paises.js") + "\n" + rd("mipais.js") + "\n" + rd("regiones.js") + "\n" + rd("comparador.js") + "\n" + rd("app.js"));
fs.writeFileSync(path.join(d, "..", "index.html"), out);
console.log("OK", out.length, "bytes");

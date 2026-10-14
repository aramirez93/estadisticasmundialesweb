// ============================================================
//  CATÁLOGOS CURADOS  (nombre claro, unidad, qué mide, cómo leerlo)
//  Fila: [id, categoría, nombre, unidad, formato, prefijo, sufijo, tono, descripción, ...extra]
//  formato: big (con "millones", "mil millones", "billones"), n0..n3 (decimales)
//  tono: good = más alto es mejor · bad = más alto es peor · neutral = depende del contexto
// ============================================================
const FUENTES = {
  wb:       {nombre: "Banco Mundial",  corto: "Banco Mundial", sub: "≈217 países · desde 1960",
             desc: "Series anuales comparables de casi todos los países del mundo (Indicadores del Desarrollo Mundial y otras 70 bases de datos).",
             url: "https://data.worldbank.org"},
  eurostat: {nombre: "Eurostat",       corto: "Eurostat", sub: "UE y vecinos · datos oficiales",
             desc: "Oficina de estadística de la Unión Europea. Cubre unos 40 países europeos (UE, AELC y candidatos) y suele publicar antes que el Banco Mundial.",
             url: "https://ec.europa.eu/eurostat"},
  imf:      {nombre: "FMI",            corto: "FMI", sub: "con proyecciones a 2031",
             desc: "Fondo Monetario Internacional (Perspectivas de la Economía Mundial). Incluye estimaciones y proyecciones futuras, que se dibujan con línea punteada. Los nombres del catálogo completo están en inglés.",
             url: "https://www.imf.org/external/datamapper"},
  cepal:    {nombre: "CEPAL",          corto: "CEPAL", sub: "América Latina y el Caribe",
             desc: "Comisión Económica para América Latina y el Caribe (CEPALSTAT). Estadísticas oficiales de la región, útiles para desigualdad y pobreza.",
             url: "https://statistics.cepal.org"}
};

const TONO_TXT = {
  good:    "Un valor más alto suele indicar una situación más favorable.",
  bad:     "Un valor más alto suele indicar una situación menos favorable.",
  neutral: "No es mejor ni peor por sí mismo: depende del contexto (tamaño del país, etapa de desarrollo, etc.)."
};

const WB_ROWS = [
  // Economía
  ["NY.GDP.MKTP.CD","Economía","PIB total","US$ corrientes","big","US$ ","","neutral","Valor de todos los bienes y servicios que produce un país en un año. Mide el tamaño de su economía."],
  ["NY.GDP.PCAP.CD","Economía","PIB por habitante","US$ corrientes","n0","US$ ","","good","El PIB dividido entre la población. Aproxima el ingreso medio por persona, pero no dice cómo se reparte."],
  ["NY.GDP.PCAP.PP.CD","Economía","PIB por habitante ajustado por costo de vida (PPA)","US$ internacionales","n0","US$ "," PPA","good","Como el PIB por habitante, pero corregido por lo que cuesta la vida en cada país. Permite comparar el poder adquisitivo real."],
  ["NY.GDP.MKTP.KD.ZG","Economía","Crecimiento del PIB","% anual","n1",""," %","good","Cuánto creció (o cayó) la economía frente al año anterior, descontando la inflación."],
  ["FP.CPI.TOTL.ZG","Economía","Inflación (precios al consumidor)","% anual","n1",""," %","bad","Aumento anual del precio de una canasta típica de consumo. Valores altos erosionan el poder de compra."],
  // Finanzas y comercio
  ["NE.EXP.GNFS.ZS","Finanzas y comercio","Exportaciones","% del PIB","n1",""," %","neutral","Bienes y servicios que el país vende al exterior, como proporción de su PIB."],
  ["NE.TRD.GNFS.ZS","Finanzas y comercio","Apertura comercial","% del PIB","n1",""," %","neutral","Exportaciones más importaciones como proporción del PIB. Mide cuán integrada está la economía con el comercio mundial."],
  ["BX.KLT.DINV.WD.GD.ZS","Finanzas y comercio","Inversión extranjera directa (entradas netas)","% del PIB","n1",""," %","neutral","Capital que llega del exterior para crear o comprar empresas en el país."],
  ["FS.AST.PRVT.GD.ZS","Finanzas y comercio","Crédito al sector privado","% del PIB","n1",""," %","neutral","Préstamos del sistema financiero a empresas y hogares. Indica cuán profundo es el sistema financiero."],
  ["BX.TRF.PWKR.DT.GD.ZS","Finanzas y comercio","Remesas recibidas","% del PIB","n1",""," %","neutral","Dinero que los emigrantes envían a su país de origen, como proporción del PIB."],
  ["FR.INR.RINR","Finanzas y comercio","Tasa de interés real","%","n1",""," %","neutral","Tasa de interés de los préstamos descontando la inflación."],
  ["PA.NUS.FCRF","Finanzas y comercio","Tipo de cambio oficial","moneda local por US$","n2","","","neutral","Cuántas unidades de la moneda local se necesitan para comprar un dólar estadounidense (promedio anual)."],
  // Gobierno y deuda
  ["GC.TAX.TOTL.GD.ZS","Gobierno y deuda","Recaudación de impuestos","% del PIB","n1",""," %","neutral","Impuestos que recauda el gobierno central, como proporción del PIB."],
  ["GC.DOD.TOTL.GD.ZS","Gobierno y deuda","Deuda del gobierno central","% del PIB","n1",""," %","bad","Lo que debe el gobierno central, como proporción del PIB."],
  ["MS.MIL.XPND.GD.ZS","Gobierno y deuda","Gasto militar","% del PIB","n2",""," %","neutral","Gasto en defensa como proporción del PIB."],
  // Población
  ["SP.POP.TOTL","Población","Población total","personas","big","","","neutral","Número de habitantes del país a mitad de año."],
  ["SP.POP.GROW","Población","Crecimiento de la población","% anual","n2",""," %","neutral","Cuánto aumenta (o disminuye) la población cada año."],
  ["SP.DYN.CBRT.IN","Población","Natalidad (tasa bruta)","nacimientos por 1.000 hab.","n1","","","neutral","Nacimientos al año por cada 1.000 habitantes."],
  ["SP.DYN.TFRT.IN","Población","Fecundidad","hijos por mujer","n2","","","neutral","Número medio de hijos que tendría una mujer en su vida con las tasas actuales. Cerca de 2,1 la población se mantiene estable."],
  ["SP.DYN.CDRT.IN","Población","Mortalidad (tasa bruta)","muertes por 1.000 hab.","n1","","","neutral","Fallecimientos al año por cada 1.000 habitantes. Depende mucho de la edad de la población."],
  ["SP.URB.TOTL.IN.ZS","Población","Población urbana","% del total","n1",""," %","neutral","Porcentaje de habitantes que vive en ciudades."],
  ["SP.POP.65UP.TO.ZS","Población","Población de 65 años o más","% del total","n1",""," %","neutral","Porcentaje de habitantes de 65 años o más. Mide el envejecimiento."],
  ["EN.POP.DNST","Población","Densidad de población","hab. por km²","n0","","","neutral","Habitantes por kilómetro cuadrado de territorio."],
  ["SM.POP.NETM","Población","Migración neta (5 años)","personas","big","","","neutral","Inmigrantes menos emigrantes en un periodo de cinco años. Negativo = salen más personas de las que llegan."],
  // Salud
  ["SP.DYN.LE00.IN","Salud","Esperanza de vida al nacer","años","n1",""," años","good","Años que viviría en promedio un recién nacido si se mantienen las condiciones actuales de mortalidad."],
  ["SP.DYN.IMRT.IN","Salud","Mortalidad infantil","por 1.000 nacidos vivos","n1","","","bad","Niños que mueren antes de cumplir un año por cada 1.000 nacidos vivos."],
  ["SH.XPD.CHEX.GD.ZS","Salud","Gasto en salud","% del PIB","n1",""," %","neutral","Gasto total (público y privado) en salud como proporción del PIB."],
  ["SH.MED.PHYS.ZS","Salud","Médicos","por 1.000 hab.","n2","","","good","Médicos disponibles por cada 1.000 habitantes."],
  ["SH.STA.MMRT","Salud","Mortalidad materna","por 100.000 nacidos vivos","n0","","","bad","Muertes de mujeres por causas del embarazo o el parto por cada 100.000 nacidos vivos."],
  ["SN.ITK.DEFC.ZS","Salud","Subalimentación","% de la población","n1",""," %","bad","Porcentaje de la población que no consume suficientes calorías para una vida activa."],
  // Educación
  ["SE.ADT.LITR.ZS","Educación","Alfabetización de adultos","% de mayores de 15 años","n1",""," %","good","Porcentaje de personas de 15 años o más que sabe leer y escribir."],
  ["SE.ADT.1524.LT.ZS","Educación","Alfabetización de jóvenes","% de 15 a 24 años","n1",""," %","good","Porcentaje de jóvenes de 15 a 24 años que sabe leer y escribir."],
  ["SE.SEC.ENRR","Educación","Matrícula en secundaria","% bruto","n1",""," %","good","Estudiantes matriculados en secundaria respecto a la población en edad escolar (puede superar 100 % por repitentes)."],
  ["SE.TER.ENRR","Educación","Matrícula en educación superior","% bruto","n1",""," %","good","Estudiantes en educación superior respecto a la población en edad de cursarla."],
  ["SE.XPD.TOTL.GD.ZS","Educación","Gasto público en educación","% del PIB","n1",""," %","neutral","Gasto del gobierno en educación como proporción del PIB."],
  // Trabajo
  ["SL.UEM.TOTL.ZS","Trabajo","Desempleo","% de la fuerza laboral","n1",""," %","bad","Porcentaje de personas activas que buscan trabajo y no lo encuentran (estimación de la OIT)."],
  ["SL.TLF.CACT.ZS","Trabajo","Participación laboral","% de mayores de 15 años","n1",""," %","neutral","Porcentaje de personas de 15 años o más que trabaja o busca trabajo."],
  ["SL.TLF.CACT.FE.ZS","Trabajo","Participación laboral femenina","% de mujeres mayores de 15","n1",""," %","good","Porcentaje de mujeres de 15 años o más que trabaja o busca trabajo."],
  ["SL.EMP.VULN.ZS","Trabajo","Empleo vulnerable","% del empleo total","n1",""," %","bad","Trabajadores por cuenta propia y familiares sin remuneración: empleos con menos protección."],
  // Pobreza y desigualdad
  ["SI.POV.GINI","Pobreza y desigualdad","Índice de Gini","0 = igualdad · 100 = máxima desigualdad","n1","","","bad","Mide qué tan desigual es el reparto del ingreso. Cuanto más alto, más concentrado está el ingreso."],
  ["SI.POV.DDAY","Pobreza y desigualdad","Pobreza extrema (línea internacional)","% de la población","n1",""," %","bad","Personas que viven por debajo de la línea internacional de pobreza extrema del Banco Mundial."],
  ["SI.POV.NAHC","Pobreza y desigualdad","Pobreza según la línea nacional","% de la población","n1",""," %","bad","Personas bajo la línea de pobreza que define cada país (no es comparable entre países)."],
  ["SI.DST.10TH.10","Pobreza y desigualdad","Ingreso del 10 % más rico","% del ingreso total","n1",""," %","bad","Parte del ingreso nacional que se queda el 10 % de la población con más ingresos."],
  // Tecnología
  ["IT.NET.USER.ZS","Tecnología","Usuarios de internet","% de la población","n1",""," %","good","Porcentaje de la población que usó internet en los últimos tres meses."],
  ["IT.CEL.SETS.P2","Tecnología","Telefonía móvil","suscripciones por 100 hab.","n1","","","neutral","Líneas móviles activas por cada 100 habitantes (puede superar 100)."],
  ["IT.NET.BBND.P2","Tecnología","Banda ancha fija","suscripciones por 100 hab.","n1","","","good","Conexiones de internet fijo de banda ancha por cada 100 habitantes."],
  ["GB.XPD.RSDV.GD.ZS","Tecnología","Inversión en investigación y desarrollo","% del PIB","n2",""," %","good","Gasto en I+D (público y privado) como proporción del PIB."],
  // Ambiente y energía
  ["AG.LND.FRST.ZS","Ambiente y energía","Superficie de bosques","% del territorio","n1",""," %","neutral","Porcentaje del territorio cubierto por bosques."],
  ["EG.ELC.RNEW.ZS","Ambiente y energía","Electricidad renovable","% de la generación","n1",""," %","good","Porcentaje de la electricidad que proviene de fuentes renovables."],
  ["EG.ELC.ACCS.ZS","Ambiente y energía","Acceso a electricidad","% de la población","n1",""," %","good","Porcentaje de la población con acceso a electricidad."],
  ["EN.ATM.PM25.MC.M3","Ambiente y energía","Contaminación del aire (PM2,5)","µg por m³","n1","","","bad","Concentración media anual de partículas finas PM2,5 a la que se expone la población."],
  ["EN.GHG.CO2.PC.CE.AR5","Ambiente y energía","Emisiones de CO₂ por habitante","toneladas por persona","n1","","","bad","Emisiones de dióxido de carbono por persona (sin uso del suelo)."]
];

const ES_ROWS = [
  // + dataset, filtros
  ["nama_10_pc","Economía","PIB por habitante","euros corrientes","n0",""," €","good","Valor de lo que produce el país en un año dividido entre su población, en euros corrientes.", "nama_10_pc", {unit:"CP_EUR_HAB", na_item:"B1GQ"}],
  ["tec00115","Economía","Crecimiento del PIB","% anual","n1",""," %","good","Variación anual del PIB en volumen (descontada la inflación).", "tec00115", {unit:"CLV_PCH_PRE", na_item:"B1GQ"}],
  ["prc_hicp_aind","Economía","Inflación (IPCA)","% anual (media)","n1",""," %","bad","Variación media anual del índice armonizado de precios al consumo, comparable entre países europeos.", "prc_hicp_aind", {unit:"RCH_A_AVG", coicop:"CP00"}],
  ["gov_10dd_edpt1","Gobierno y deuda","Deuda pública","% del PIB","n1",""," %","bad","Deuda bruta consolidada de las administraciones públicas, como proporción del PIB.", "gov_10dd_edpt1", {unit:"PC_GDP", sector:"S13", na_item:"GD"}],
  ["demo_pjan","Población","Población a 1 de enero","personas","big","","","neutral","Habitantes residentes a 1 de enero de cada año.", "demo_pjan", {age:"TOTAL", sex:"T"}],
  ["demo_mlexpec","Salud","Esperanza de vida al nacer","años","n1",""," años","good","Años que viviría en promedio un recién nacido con las condiciones de mortalidad de ese año.", "demo_mlexpec", {age:"Y_LT1", sex:"T"}],
  ["une_rt_a","Trabajo","Desempleo (15 a 74 años)","% de la población activa","n1",""," %","bad","Personas de 15 a 74 años sin empleo que lo buscan, como proporción de la población activa.", "une_rt_a", {unit:"PC_ACT", sex:"T", age:"Y15-74"}],
  ["lfsi_emp_a","Trabajo","Población activa (20 a 64 años)","% de la población de 20-64","n1",""," %","neutral","Porcentaje de personas de 20 a 64 años que trabaja o busca empleo.", "lfsi_emp_a", {indic_em:"ACT", sex:"T", age:"Y20-64", unit:"PC_POP"}],
  ["ilc_peps01n","Pobreza y desigualdad","Riesgo de pobreza o exclusión social","% de la población","n1",""," %","bad","Personas con bajos ingresos, privación material grave o que viven en hogares con muy poco empleo (indicador AROPE).", "ilc_peps01n", {unit:"PC", age:"TOTAL", sex:"T"}],
  ["ilc_di12","Pobreza y desigualdad","Índice de Gini","0 = igualdad · 100 = máxima desigualdad","n1","","","bad","Desigualdad del ingreso disponible de los hogares (ajustado por tamaño del hogar).", "ilc_di12", {age:"TOTAL", statinfo:"GINI_HND"}],
  ["isoc_ci_ifp_iu","Tecnología","Uso de internet","% de las personas","n1",""," %","good","Personas que usaron internet en los últimos tres meses.", "isoc_ci_ifp_iu", {ind_type:"IND_TOTAL", indic_is:"I_IU3", unit:"PC_IND"}]
];

// extra: factor de escala a unidades enteras
const IMF_ROWS = [
  ["NGDPD","Economía","PIB total","US$ corrientes","big","US$ ","","neutral","Valor de todos los bienes y servicios producidos en un año, en dólares corrientes.", 1e9],
  ["NGDPDPC","Economía","PIB por habitante","US$ corrientes","n0","US$ ","","good","PIB dividido entre la población, en dólares corrientes.", 1],
  ["PPPPC","Economía","PIB por habitante ajustado por costo de vida (PPA)","US$ internacionales","n0","US$ "," PPA","good","PIB por habitante corregido por el costo de vida de cada país: mide poder adquisitivo.", 1],
  ["NGDP_RPCH","Economía","Crecimiento del PIB real","% anual","n1",""," %","good","Cuánto crece (o cae) la economía cada año, descontando la inflación.", 1],
  ["PCPIPCH","Economía","Inflación (promedio anual)","% anual","n1",""," %","bad","Variación media anual de los precios al consumidor.", 1],
  ["PCPIEPCH","Economía","Inflación (diciembre a diciembre)","% anual","n1",""," %","bad","Variación de los precios al consumidor entre el final de un año y el del siguiente.", 1],
  ["NID_NGDP","Economía","Inversión total","% del PIB","n1",""," %","neutral","Inversión de empresas, hogares y gobierno como proporción del PIB.", 1],
  ["NGSD_NGDP","Economía","Ahorro nacional bruto","% del PIB","n1",""," %","neutral","Parte del ingreso nacional que no se consume, como proporción del PIB.", 1],
  ["LUR","Trabajo","Desempleo","% de la fuerza laboral","n1",""," %","bad","Porcentaje de personas activas que buscan empleo y no lo encuentran.", 1],
  ["GGXWDG_NGDP","Gobierno y deuda","Deuda bruta del gobierno","% del PIB","n1",""," %","bad","Deuda total del gobierno general, como proporción del PIB.", 1],
  ["GGXCNL_NGDP","Gobierno y deuda","Balance fiscal del gobierno","% del PIB","n1",""," %","good","Ingresos menos gastos del gobierno. Positivo = superávit; negativo = déficit.", 1],
  ["BCA_NGDPD","Finanzas y comercio","Cuenta corriente","% del PIB","n1",""," %","neutral","Diferencia entre lo que el país gana y gasta con el exterior. Negativo = depende de financiamiento externo.", 1],
  ["LP","Población","Población","personas","big","","","neutral","Número de habitantes.", 1e6]
];

// extra: miembros fijos por dimensión {idDimensión: idMiembro}
const CEPAL_ROWS = [
  ["3328:pob","Pobreza y desigualdad","Pobreza","% de la población","n1",""," %","bad","Porcentaje de personas bajo la línea de pobreza (total nacional).", {1361:1362}],
  ["3328:ext","Pobreza y desigualdad","Pobreza extrema","% de la población","n1",""," %","bad","Porcentaje de personas bajo la línea de pobreza extrema o indigencia (total nacional).", {1361:1363}],
  ["3289","Pobreza y desigualdad","Índice de Gini","0 = igualdad · 1 = máxima desigualdad","n3","","","bad","Concentración del ingreso. Cuanto más cerca de 1, más desigual (total nacional).", {}],
  ["127","Trabajo","Desempleo","% de la población activa","n1",""," %","bad","Tasa de desocupación: personas activas sin empleo que lo buscan (ambos sexos).", {}],
  ["2236","Educación","Alfabetización (15 años y más)","% de la población","n1",""," %","good","Porcentaje de personas de 15 años o más que sabe leer y escribir (ambos sexos).", {}],
  ["2203","Economía","PIB total","US$ corrientes","big","US$ ","","neutral","Producto interno bruto anual a precios corrientes en dólares.", {}]
];

const CATALOGO = {wb: [], eurostat: [], imf: [], cepal: []};
const base = (src, r) => ({key: src + ":" + r[0], src, id: String(r[0]).split(":")[0], cat: r[1], name: r[2], unit: r[3], k: r[4], pre: r[5], suf: r[6], tone: r[7], desc: r[8], curated: true});
WB_ROWS.forEach(r => CATALOGO.wb.push(base("wb", r)));
ES_ROWS.forEach(r => CATALOGO.eurostat.push(Object.assign(base("eurostat", r), {ds: r[9], flt: r[10]})));
IMF_ROWS.forEach(r => CATALOGO.imf.push(Object.assign(base("imf", r), {scale: r[9]})));
CEPAL_ROWS.forEach(r => CATALOGO.cepal.push(Object.assign(base("cepal", r), {pick: r[9]})));

const MUESTRA = ["COL","MEX","BRA","ARG","USA","ESP","DEU","FRA","CHN","IND","JPN","NGA","ZAF","EGY","AUS","NZL"];
const MUESTRA_FUENTE = {
  eurostat: ["ESP","DEU","FRA","ITA","SWE","POL","NLD","PRT","GRC","NOR","CHE","TUR"],
  cepal: ["COL","MEX","BRA","ARG","CHL","PER","ECU","URY","CRI","DOM","BOL","PRY"]
};
const OFICINAS = [
  ["Colombia – DANE","https://www.dane.gov.co"],["México – INEGI","https://www.inegi.org.mx"],
  ["Brasil – IBGE","https://www.ibge.gov.br"],["Argentina – INDEC","https://www.indec.gob.ar"],
  ["Chile – INE","https://www.ine.gob.cl"],["Perú – INEI","https://www.inei.gob.pe"],
  ["EE. UU. – Census Bureau","https://www.census.gov"],["España – INE","https://www.ine.es"],
  ["Alemania – Destatis","https://www.destatis.de"],["Francia – INSEE","https://www.insee.fr"],
  ["Unión Europea – Eurostat","https://ec.europa.eu/eurostat"],["China – NBS","https://www.stats.gov.cn"],
  ["India – MoSPI","https://mospi.gov.in"],["Japón – Statistics Bureau","https://www.stat.go.jp"],
  ["Nigeria – NBS","https://nigerianstat.gov.ng"],["Sudáfrica – Stats SA","https://www.statssa.gov.za"],
  ["Egipto – CAPMAS","https://www.capmas.gov.eg"],["Australia – ABS","https://www.abs.gov.au"],
  ["Nueva Zelanda – Stats NZ","https://www.stats.govt.nz"],["ONU – UNData","https://data.un.org"],
  ["FMI – Data","https://www.imf.org/en/Data"],["OCDE – Data","https://data.oecd.org"],
  ["CEPAL – CEPALSTAT","https://statistics.cepal.org"],["BID – Data","https://data.iadb.org"]
];
const CONT_NOMBRE = {AF:"África", AS:"Asia", EU:"Europa", NA:"América del Norte y Central", SA:"América del Sur", OC:"Oceanía", AN:"Antártida"};
const PALETAS = {   // ColorBrewer, 7 clases
  good:    ["#edf8e9","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#005a32"],
  bad:     ["#fef0d9","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#990000"],
  neutral: ["#eff3ff","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#084594"]
};
const LINEAS = ["#0b6e4f","#d1495b","#2e86ab","#edae49","#6a4c93","#00798c","#e07a5f","#3d405b","#81b29a","#9c6644","#118ab2","#ef476f"];

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
             url: "https://statistics.cepal.org"},
  oms:      {nombre: "OMS",            corto: "OMS", sub: "salud · Observatorio Mundial", ext: true,
             desc: "Organización Mundial de la Salud (Observatorio Mundial de la Salud). Estimaciones comparables de salud: vida saludable, obesidad, cobertura sanitaria y más. Se descargan a diario con una acción de GitHub.",
             url: "https://www.who.int/data/gho"},
  oit:      {nombre: "OIT",            corto: "OIT", sub: "trabajo · ILOSTAT", ext: true,
             desc: "Organización Internacional del Trabajo (ILOSTAT). Empleo informal, horas trabajadas, afiliación sindical y desempleo juvenil. Se descargan a diario con una acción de GitHub.",
             url: "https://ilostat.ilo.org"},
  owid:     {nombre: "Our World in Data", corto: "OWID", sub: "desarrollo y curiosidades", ext: true,
             desc: "Our World in Data (Universidad de Oxford). Reúne series de organismos como la ONU, el PNUD o la FAO: felicidad, desarrollo humano, calorías, hambre y horas de trabajo. Licencia CC BY 4.0. Se descargan a diario con una acción de GitHub.",
             url: "https://ourworldindata.org"},
  acnur:    {nombre: "ACNUR", corto: "ACNUR", sub: "refugiados y desplazados", ext: true,
             desc: "Agencia de la ONU para los Refugiados (ACNUR). Cuántas personas refugiadas, solicitantes de asilo y desplazadas internas hay en cada país, desde el año 2000. Se descargan a diario con una acción de GitHub.",
             url: "https://www.unhcr.org/refugee-statistics"}
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
  ["EN.GHG.CO2.PC.CE.AR5","Ambiente y energía","Emisiones de CO₂ por habitante","toneladas por persona","n1","","","bad","Emisiones de dióxido de carbono por persona (sin uso del suelo)."],
  // Estructura de la economía
  ["NV.AGR.TOTL.ZS","Economía","Agricultura en la economía","% del PIB","n1",""," %","neutral","Parte del PIB que aportan la agricultura, la ganadería, la pesca y la silvicultura. Baja a medida que los países se desarrollan."],
  ["NV.IND.TOTL.ZS","Economía","Industria en la economía","% del PIB","n1",""," %","neutral","Parte del PIB que aportan la minería, la manufactura, la construcción y los servicios públicos como energía y agua."],
  ["NV.SRV.TOTL.ZS","Economía","Servicios en la economía","% del PIB","n1",""," %","neutral","Parte del PIB que aportan el comercio, el transporte, las finanzas, el turismo y demás servicios."],
  ["SL.AGR.EMPL.ZS","Trabajo","Empleo en agricultura","% del empleo total","n1",""," %","neutral","Porcentaje de las personas ocupadas que trabaja en el campo. Cuanto menor, más industrializada o de servicios es la economía."],
  // Curiosidades
  ["SG.GEN.PARL.ZS","Curiosidades","Mujeres en el parlamento","% de los escaños","n1",""," %","good","Porcentaje de escaños del parlamento nacional ocupados por mujeres (cifras de la Unión Interparlamentaria)."],
  ["SG.LAW.INDX","Curiosidades","Igualdad legal de la mujer","0 a 100 puntos","n1","","","good","Índice «Mujeres, Empresa y el Derecho»: mide cuántas leyes tratan igual a hombres y mujeres en su vida laboral y económica. 100 = igualdad plena."],
  ["ST.INT.ARVL","Curiosidades","Llegadas de turistas internacionales","personas por año","big","","","neutral","Visitantes extranjeros que llegan al país en un año, según la Organización Mundial del Turismo."],
  ["ST.INT.RCPT.CD","Curiosidades","Ingresos por turismo internacional","US$ corrientes","big","US$ ","","neutral","Dinero que gastan los turistas extranjeros en el país en un año."],
  ["IS.AIR.PSGR","Curiosidades","Pasajeros aéreos transportados","pasajeros por año","big","","","neutral","Pasajeros que viajaron en las aerolíneas registradas en el país (nacionales e internacionales)."],
  ["VC.IHR.PSRC.P5","Curiosidades","Homicidios intencionales","por 100.000 hab.","n1","","","bad","Muertes por agresión intencional por cada 100.000 habitantes (Oficina de la ONU contra la Droga y el Delito)."],
  ["SH.STA.TRAF.P5","Curiosidades","Muertes por accidentes de tránsito","por 100.000 hab.","n1","","","bad","Muertes en las vías por cada 100.000 habitantes (Organización Mundial de la Salud)."],
  ["SH.ALC.PCAP.LI","Curiosidades","Consumo de alcohol","litros de alcohol puro por persona","n1","","","neutral","Litros de alcohol puro que consume al año, en promedio, cada persona de 15 años o más."],
  ["EG.USE.ELEC.KH.PC","Curiosidades","Consumo de electricidad por habitante","kWh por persona","n0","","","neutral","Electricidad que usa cada habitante en un año, en kilovatios hora. Refleja el nivel de industria y comodidades del país."],
  ["SP.POP.SCIE.RD.P6","Curiosidades","Investigadores","por millón de habitantes","n0","","","good","Personas dedicadas a la investigación y el desarrollo por cada millón de habitantes."],
  ["IP.PAT.RESD","Curiosidades","Patentes solicitadas por residentes","solicitudes por año","big","","","good","Solicitudes de patente presentadas cada año por personas o empresas del propio país."],
  ["TX.VAL.TECH.MF.ZS","Curiosidades","Exportaciones de alta tecnología","% de las exportaciones manufacturadas","n1",""," %","good","Parte de las exportaciones industriales que corresponde a productos de alta tecnología (aeroespacial, computadores, farmacia, electrónica)."],
  ["IT.NET.SECR.P6","Curiosidades","Servidores de internet seguros","por millón de habitantes","n0","","","good","Servidores que usan cifrado seguro (HTTPS) por cada millón de habitantes. Aproxima el desarrollo del comercio digital."],
  ["SH.IMM.MEAS","Curiosidades","Vacunación contra el sarampión","% de niños de 12 a 23 meses","n1",""," %","good","Porcentaje de niños vacunados contra el sarampión. Se necesita cerca de un 95 % para frenar los brotes."],
  ["SH.DYN.MORT","Curiosidades","Mortalidad de menores de 5 años","por 1.000 nacidos vivos","n1","","","bad","Niños que mueren antes de cumplir 5 años por cada 1.000 nacidos vivos."],
  ["SH.H2O.BASW.ZS","Curiosidades","Agua potable básica","% de la población","n1",""," %","good","Porcentaje de la población que dispone de un servicio básico de agua potable."],
  ["ER.H2O.FWTL.ZS","Curiosidades","Uso de agua dulce","% de los recursos internos","n1",""," %","neutral","Agua dulce extraída para riego, industria y consumo, como proporción de los recursos propios del país. Por encima de 25 % hay estrés hídrico."],
  ["AG.LND.ARBL.ZS","Curiosidades","Tierra cultivable","% del territorio","n1",""," %","neutral","Porcentaje del territorio apto para cultivos de ciclo corto como cereales, hortalizas o caña."],
  ["SP.DYN.SMAM.FE","Curiosidades","Edad media al primer matrimonio (mujeres)","años","n1","","","neutral","Edad media a la que las mujeres se casan por primera vez."],
  ["IC.REG.DURS","Curiosidades","Días para abrir una empresa","días","n0","","","bad","Tiempo que toman los trámites para registrar una empresa nueva."]
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
  ["LUR","Trabajo","Desempleo","% de la fuerza laboral","n1",""," %","bad","Porcentaje de personas activas que buscan empleo y no lo encuentran.", 1],
  ["GGXWDG_NGDP","Gobierno y deuda","Deuda bruta del gobierno","% del PIB","n1",""," %","bad","Deuda total del gobierno general, como proporción del PIB.", 1],
  ["GGXCNL_NGDP","Gobierno y deuda","Balance fiscal del gobierno","% del PIB","n1",""," %","good","Ingresos menos gastos del gobierno. Positivo = superávit; negativo = déficit.", 1],
  ["BCA_NGDPD","Finanzas y comercio","Cuenta corriente","% del PIB","n1",""," %","neutral","Diferencia entre lo que el país gana y gasta con el exterior. Negativo = depende de financiamiento externo.", 1],
  ["LP","Población","Población","personas","big","","","neutral","Número de habitantes.", 1e6],
  ["PPPSH","Economía","Peso en la economía mundial (PPA)","% del PIB mundial","n2",""," %","neutral","Qué porcentaje de toda la producción del planeta, medida a precios comparables (paridad de poder adquisitivo), aporta este país.", 1],
  ["rev","Gobierno y deuda","Ingresos del gobierno","% del PIB","n1",""," %","neutral","Impuestos y otros ingresos del gobierno, como proporción del PIB. Serie histórica muy larga (base «Finanzas públicas en la historia moderna» del FMI).", 1],
  ["exp","Gobierno y deuda","Gasto del gobierno","% del PIB","n1",""," %","neutral","Todo lo que gasta el gobierno, como proporción del PIB. Serie histórica muy larga.", 1],
  ["ie","Gobierno y deuda","Intereses de la deuda pública","% del PIB","n1",""," %","bad","Lo que paga el gobierno cada año solo por los intereses de su deuda. Es dinero que no se destina a servicios ni inversión.", 1],
  ["pb","Gobierno y deuda","Balance primario del gobierno","% del PIB","n1",""," %","good","Ingresos menos gastos, sin contar los intereses de la deuda. Positivo = el gobierno puede reducir su deuda con sus propios recursos.", 1],
  ["Privatedebt_all","Finanzas y comercio","Deuda privada (hogares y empresas)","% del PIB","n1",""," %","neutral","Todo lo que deben las familias y las empresas no financieras, como proporción del PIB (Base Global de Deuda del FMI).", 1],
  ["HH_ALL","Finanzas y comercio","Deuda de los hogares","% del PIB","n1",""," %","neutral","Lo que deben las familias en préstamos y otros instrumentos, como proporción del PIB.", 1],
  ["NFC_ALL","Finanzas y comercio","Deuda de las empresas no financieras","% del PIB","n1",""," %","neutral","Lo que deben las empresas (sin contar bancos ni aseguradoras), como proporción del PIB.", 1],
  ["AI_PI","Curiosidades","Preparación para la inteligencia artificial","índice de 0 a 1","n2","","","good","Índice del FMI (2023) que mide qué tan listo está el país para adoptar la IA: infraestructura digital, capital humano, innovación y regulación.", 1],
  ["GII_TC","Curiosidades","Desigualdad de género (índice)","0 = igualdad · 1 = máxima desigualdad","n2","","","bad","Índice de desigualdad de género con serie homogénea en el tiempo (Stotsky y otros, 2016, para el FMI). Combina salud reproductiva, empoderamiento y mercado laboral.", 1],
  ["total_theil","Curiosidades","Concentración de las exportaciones (Theil)","índice","n2","","","neutral","Índice de Theil del FMI: cuanto más alto, más concentradas están las exportaciones en pocos productos; cuanto más bajo, más diversificadas.", 1],
  ["SITC1_total","Curiosidades","Calidad de las exportaciones","índice","n2","","","good","Índice del FMI que resume la calidad y sofisticación de lo que exporta el país.", 1]
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

const OMS_ROWS = [
  ["WHOSIS_000002","Salud","Esperanza de vida saludable","años","n1",""," años","good","Años que, en promedio, una persona puede esperar vivir con buena salud desde que nace. Es menor que la esperanza de vida total porque descuenta los años con enfermedad o discapacidad.", 1],
  ["NCD_BMI_30A","Salud","Obesidad en adultos","% de adultos con IMC ≥ 30","n1",""," %","bad","Porcentaje de adultos con un índice de masa corporal de 30 o más (estimación ajustada por edad para poder comparar países).", 1],
  ["NCD_BMI_25A","Salud","Sobrepeso en adultos","% de adultos con IMC ≥ 25","n1",""," %","bad","Porcentaje de adultos con un índice de masa corporal de 25 o más, incluida la obesidad (ajustado por edad).", 1],
  ["NCD_HYP_PREVALENCE_A","Salud","Hipertensión en adultos","% de adultos de 30 a 79 años","n1",""," %","bad","Porcentaje de adultos con presión arterial alta (ajustado por edad). Es un factor de riesgo clave de infartos y derrames.", 1],
  ["M_Est_smk_curr_std","Salud","Fumadores actuales de tabaco","% de personas de 15 años o más","n1",""," %","bad","Porcentaje de personas que fuman tabaco actualmente (ajustado por edad).", 1],
  ["UHC_INDEX_REPORTED","Salud","Cobertura sanitaria universal","índice de 0 a 100","n0","","","good","Índice de la ONU y la OMS (ODS 3.8.1) que resume el acceso a servicios de salud esenciales: maternidad, vacunación, enfermedades infecciosas y no transmisibles.", 1],
  ["WSH_SANITATION_SAFELY_MANAGED","Salud","Saneamiento seguro","% de la población","n1",""," %","good","Población que usa baños no compartidos, cuyos residuos se tratan de forma segura.", 1],
  ["HWF_0006","Salud","Personal de enfermería y partería","por 10.000 habitantes","n1","","","good","Enfermeras, enfermeros y parteras por cada 10.000 habitantes.", 1],
  ["WHS6_102","Salud","Camas de hospital","por 10.000 habitantes","n1","","","good","Camas hospitalarias por cada 10.000 habitantes.", 1],
  ["PHE_HHAIR_PROP_POP_CLEAN_FUELS","Ambiente y energía","Cocina con combustibles limpios","% de la población","n1",""," %","good","Población que cocina con gas, electricidad u otras fuentes limpias en lugar de leña o carbón, que contaminan el aire de la casa.", 1]
];
const OIT_ROWS = [
  ["UNE_2EAP_SEX_AGE_RT_A","Trabajo","Desempleo juvenil (15 a 24 años)","% de la fuerza laboral joven","n1",""," %","bad","Porcentaje de jóvenes de 15 a 24 años que buscan trabajo y no lo encuentran.", 1],
  ["SDG_0831_SEX_ECO_RT_A","Trabajo","Empleo informal","% del empleo total","n1",""," %","bad","Porcentaje de las personas ocupadas con empleos sin contrato formal ni protección social.", 1],
  ["HOW_TEMP_SEX_ECO_NB_A","Trabajo","Horas trabajadas por semana","horas por persona ocupada","n1",""," h","neutral","Horas que trabaja en promedio por semana cada persona con empleo.", 1],
  ["ILR_TUMT_NOC_RT_A","Trabajo","Afiliación sindical","% de los asalariados","n1",""," %","neutral","Porcentaje de los trabajadores asalariados que pertenece a un sindicato.", 1]
];
const OWID_ROWS = [
  ["happiness-cantril-ladder","Curiosidades","Felicidad: satisfacción con la vida","escala de 0 a 10","n2","","","good","Qué nota de 0 a 10 se dan las personas al valorar su vida (Informe Mundial de la Felicidad, encuesta Gallup).", 1],
  ["human-development-index","Economía","Índice de Desarrollo Humano","índice de 0 a 1","n3","","","good","Resume en un número la salud (esperanza de vida), la educación y el ingreso de un país. Lo publica el PNUD (ONU).", 1],
  ["daily-per-capita-caloric-supply","Salud","Calorías disponibles por persona","kilocalorías por día","n0","","","neutral","Calorías de alimentos que hay disponibles cada día por persona (FAO). No es lo que se come: incluye desperdicio.", 1],
  ["global-hunger-index","Salud","Índice Global del Hambre","0 = sin hambre · 100 = máximo","n1","","","bad","Resume desnutrición, retraso del crecimiento infantil y mortalidad infantil (Welthungerhilfe y Concern).", 1],
  ["meat-supply-per-person","Curiosidades","Carne disponible por persona","kg por persona al año","n1","","","neutral","Kilos de carne disponibles cada año por persona (FAO).", 1],
  ["annual-working-hours-per-worker","Trabajo","Horas de trabajo al año","horas por trabajador","n0","","","neutral","Horas que trabaja al año, en promedio, cada persona con empleo (Penn World Table).", 1],
  ["per-capita-energy-use","Ambiente y energía","Consumo de energía por persona","kWh por persona al año","n0","","","neutral","Energía primaria que usa cada persona al año, en kilovatios hora (Energy Institute).", 1],
  ["gdp-per-capita-maddison-project-database","Economía","PIB por habitante desde 1820 (Maddison)","dólares de 2011 ajustados por precios","n0","US$ ","","good","Serie histórica larga del PIB por habitante, reconstruida por historiadores económicos (Maddison Project Database). Sirve para ver siglos de crecimiento.", 1],
  ["democracy-index-eiu","Gobierno y deuda","Índice de Democracia","escala de 0 a 10","n2","","","good","Califica de 0 a 10 qué tan democrático es un país: elecciones, libertades civiles y funcionamiento del gobierno (Economist Intelligence Unit).", 1],
  ["ti-corruption-perception-index","Gobierno y deuda","Percepción de corrupción","0 = muy corrupto · 100 = muy limpio","n0","","","good","Qué tan corrupto se percibe el sector público según expertos y empresarios (Transparencia Internacional). Un número más alto es mejor.", 1],
  ["gender-inequality-index-from-the-human-development-report","Pobreza y desigualdad","Índice de Desigualdad de Género","índice de 0 a 1","n3","","","bad","Mide las brechas entre mujeres y hombres en salud reproductiva, empoderamiento y mercado laboral (PNUD). Más cerca de 0 es más igualdad.", 1],
  ["global-gender-gap-index","Pobreza y desigualdad","Brecha global de género","0 = brecha total · 1 = igualdad","n3","","","good","Qué tan cerca está un país de la igualdad entre mujeres y hombres en economía, educación, salud y política (Foro Económico Mundial).", 1],
  ["homicide-rate-unodc","Curiosidades","Tasa de homicidios","homicidios por 100.000 habitantes","n1","","","bad","Homicidios intencionales por cada 100.000 habitantes (Oficina de la ONU contra la Droga y el Delito).", 1],
  ["renewable-share-energy","Ambiente y energía","Energías renovables en la energía total","% de la energía primaria","n1","",""," %","good","Parte de toda la energía que consume el país (no solo electricidad) que viene de fuentes renovables (Energy Institute).", 1],
  ["share-electricity-renewables","Ambiente y energía","Electricidad renovable","% de la electricidad","n1","","","good","Parte de la electricidad generada con fuentes renovables: agua, viento, sol y otras (Ember y Energy Institute).", 1],
  ["carbon-intensity-electricity","Ambiente y energía","Emisiones de la electricidad","gramos de CO₂ por kWh","n0","","","bad","Cuánto CO₂ se emite por cada kilovatio hora de electricidad generada (Ember). Menos es mejor.", 1],
  ["median-age","Población","Edad mediana","años","n1","","","neutral","Edad que divide a la población en dos mitades iguales: la mitad es más joven y la otra, mayor (ONU).", 1],
  ["mean-years-of-schooling","Educación","Años de escolaridad promedio","años","n1","","","good","Años de estudio que ha completado, en promedio, la población adulta (PNUD y UNESCO).", 1],
  ["total-alcohol-consumption-per-capita-litres-of-pure-alcohol","Curiosidades","Consumo de alcohol","litros de alcohol puro por persona al año","n1","","","neutral","Litros de alcohol puro que consume al año cada persona de 15 años o más (OMS).", 1],
  ["plastic-waste-per-capita","Ambiente y energía","Residuos plásticos por persona","kg por persona al día","n2","","","bad","Cuántos kilos de residuos plásticos genera cada persona al día (Our World in Data a partir de Jambeck et al.).", 1]
];
const ACNUR_ROWS = [
  ["ref_acogidos","Población","Refugiados acogidos","personas refugiadas que viven en el país","big","","","neutral","Personas que huyeron de su país por persecución o conflicto y están refugiadas en este país (ACNUR).", 1],
  ["ref_origen","Población","Refugiados de origen","personas del país refugiadas en el exterior","big","","","bad","Personas de este país que han tenido que huir y viven como refugiadas en otros países (ACNUR).", 1],
  ["desplaz_internos","Población","Desplazados internos","personas desplazadas dentro del país","big","","","bad","Personas obligadas a abandonar su hogar por conflicto o violencia, pero que siguen dentro de su propio país (ACNUR).", 1],
  ["asilo_solicitudes","Población","Solicitantes de asilo","personas con solicitud de asilo pendiente","big","","","neutral","Personas que han pedido protección internacional en este país y esperan respuesta (ACNUR).", 1]
];

const CATALOGO = {wb: [], eurostat: [], imf: [], cepal: [], oms: [], oit: [], owid: [], acnur: []};
const base = (src, r) => ({key: src + ":" + r[0], src, id: String(r[0]).split(":")[0], cat: r[1], name: r[2], unit: r[3], k: r[4], pre: r[5], suf: r[6], tone: r[7], desc: r[8], curated: true});
WB_ROWS.forEach(r => CATALOGO.wb.push(base("wb", r)));
ES_ROWS.forEach(r => CATALOGO.eurostat.push(Object.assign(base("eurostat", r), {ds: r[9], flt: r[10]})));
IMF_ROWS.forEach(r => CATALOGO.imf.push(Object.assign(base("imf", r), {scale: r[9]})));
CEPAL_ROWS.forEach(r => CATALOGO.cepal.push(Object.assign(base("cepal", r), {pick: r[9]})));
OMS_ROWS.forEach(r => CATALOGO.oms.push(Object.assign(base("oms", r), {scale: r[9]})));
OIT_ROWS.forEach(r => CATALOGO.oit.push(Object.assign(base("oit", r), {scale: r[9]})));
OWID_ROWS.forEach(r => CATALOGO.owid.push(Object.assign(base("owid", r), {scale: r[9]})));
ACNUR_ROWS.forEach(r => CATALOGO.acnur.push(Object.assign(base("acnur", r), {scale: r[9]})));

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

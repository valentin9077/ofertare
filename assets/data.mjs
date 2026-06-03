export const domains = [
  ['A','Sanitare - conducte alimentare apă'],
  ['B','Canalizare menajeră'],
  ['C','Canalizare pluvială'],
  ['D','Obiecte sanitare'],
  ['E','Armături și accesorii'],
  ['F','Izolații termice'],
  ['G','Hidranți interiori'],
  ['H','Dotări mijloace tehnice PSI'],
  ['I','Probe de presiune și funcționare'],
  ['J','Gospodărie apă și PSI'],
  ['K','Radiatoare'],
  ['L','Aparate, armături, accesorii'],
  ['M','Instalații ventilare'],
  ['N','Echipamente'],
  ['Z','Diverse']
];

export const seed = {
  company: {
    name: 'SCV AQUA PREMIUM INSTAL SRL',
    cui: 'RO47989333',
    reg: 'J23/2461/2023',
    address: 'Str. Amurgului 43, Bl.3, Et.1, Ap.7, Popești-Leordeni, Ilfov',
    phone: '0737 757 673',
    email: 'simpteavalentin@yahoo.com',
    iban: 'RO52BTRLRONCRT0CW5784401',
    bank: 'Banca Transilvania',
    vat: 21,
    advance: 30,
    warranty: 24,
    validDays: 30
  },
  clients: [
    { id:'c1', name:'ROM SERVICE CONSTRUCT SRL', cui:'RO3511905', reg:'J40/1234/2018', address:'București, Sector 6', phone:'', email:'email@beneficiar.ro', site:'Cantina UTCB' }
  ],
  catalog: [
    ['PPR-D63','A','Țeavă PP-R De63','Țeavă PP-R îmbinată prin polifuziune, inclusiv fitinguri De63','ml',54.60,'componentă','teava ppr d63,ppr 63'],
    ['PPR-D50','A','Țeavă PP-R De50','Țeavă PP-R îmbinată prin polifuziune, inclusiv fitinguri De50','ml',46.80,'componentă','teava ppr d50,ppr 50'],
    ['PPR-D40','A','Țeavă PP-R De40','Țeavă PP-R îmbinată prin polifuziune, inclusiv fitinguri De40','ml',39.00,'componentă','teava ppr d40,ppr 40'],
    ['PPR-D32','A','Țeavă PP-R De32','Țeavă PP-R îmbinată prin polifuziune, inclusiv fitinguri De32','ml',33.15,'componentă','teava ppr d32,ppr 32'],
    ['PPR-D25','A','Țeavă PP-R De25','Țeavă PP-R coloane, inclusiv fitinguri De25','ml',29.25,'componentă','teava ppr d25,ppr 25'],
    ['PPR-D20','A','Țeavă PP-R De20','Conducte legătură obiecte sanitare De20','ml',25.35,'componentă','teava ppr d20,ppr 20'],
    ['OL-DN25','A','Conductă OL zincat Dn25','Conductă oțel zincat PN25, Armaflex 19mm','ml',58.50,'componentă','conducta ol zincat dn25,otel zincat 25'],
    ['OL-DN32','A','Conductă OL zincat Dn32','Conductă oțel zincat PN25, Armaflex 19mm','ml',66.30,'componentă','conducta ol zincat dn32,otel zincat 32'],
    ['PVC-110','B','Canalizare PVC-KG DN110','Țeavă PVC-KG canalizare menajeră DN110','ml',24.00,'componentă','pvc kg 110,teava pvc dn110'],
    ['PVC-200','C','Canalizare PVC-KG DN200','Țeavă PVC-KG canalizare pluvială DN200','ml',42.00,'componentă','pvc kg 200,teava pvc dn200'],
    ['MNT-LAV','D','Montaj lavoar complet','Baterie, ventil, sifon, racorduri, coliere și fixare','buc',350.00,'pachet','lavoar complet,montaj lavoar'],
    ['MNT-WC','D','Montaj WC complet','Rezervor, vas, ramă, set conectare, robinet colț','buc',420.00,'pachet','wc complet,montaj wc'],
    ['IZ-ARM19','F','Izolație Armaflex 19mm','Izolație termică conducte cu Armaflex 19mm','ml',18.00,'componentă','armaflex 19,izolatie armaflex'],
    ['HID-OL','G','Hidrant interior OL sudat','Conducte oțel sudat pentru hidranți interiori','ml',85.00,'componentă','hidrant ol sudat,conducte hidrant'],
    ['PSI-DOT','H','Dotare mijloace tehnice stingere incendiu','Montaj dotări PSI conform proiect','buc',3555.00,'pachet','dotare psi,mijloace stingere'],
    ['PROB-PRS','I','Probe de presiune și funcționare','Probare instalație conform normativelor','ans',850.00,'serviciu','proba presiune,probe functionare'],
    ['RAD-MNT','K','Montaj radiator','Radiator, robinet termostat, robinet retur, aerisire','buc',220.00,'pachet','radiator,montaj calorifer'],
    ['VENT-MNT','M','Instalații ventilare','Montaj elemente instalații ventilare','buc',141827.60,'pachet','ventilare,instalatii ventilare'],
    ['ECHIP','N','Echipamente','Montaj echipamente conform proiect','buc',16150.00,'pachet','echipamente'],
    ['DIV','Z','Diverse','Lucrări diverse neîncadrate','buc',63903.85,'serviciu','diverse']
  ].map((x,i)=>({ id:'p'+(i+1), code:x[0], domain:x[1], name:x[2], desc:x[3], unit:x[4], price:x[5], type:x[6], aliases:x[7].split(',') })),
  offers: [],
  imports: [],
  projects: [],
  situations: [],
  warranties: [],
  expenses: [],
  employees: [
    { id:'e1', name:'Rotaru Dan', dailyRate:722 },
    { id:'e2', name:'Dinu Constantin', dailyRate:722 },
    { id:'e3', name:'Iosif Cristi', dailyRate:610 },
    { id:'e4', name:'Ionescu Marius', dailyRate:555 },
    { id:'e5', name:'Epure Ovidiu', dailyRate:527 }
  ],
  attendance: []
};

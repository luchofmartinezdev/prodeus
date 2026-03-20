export interface Country {
    id: string;
    name: string;
    code?: string;
    flagUrl?: string;
    repechageFlagUrl?: string[]; // Array de URLs directas
    type?: 'national' | 'club';
    country?: string;
}

export const COUNTRIES_DATA: Country[] = [
    // --- GRUPO A ---
    { id: 'mex', name: 'México', code: 'mx', flagUrl: 'https://flagcdn.com/mx.svg' },
    { id: 'rsa', name: 'Sudáfrica', code: 'za', flagUrl: 'https://flagcdn.com/za.svg' },
    { id: 'kor', name: 'República de Corea', code: 'kr', flagUrl: 'https://flagcdn.com/kr.svg' },
    {
        id: 'rep_a1',
        name: 'Dinamarca/Macedonia/Checa/Irlanda',
        repechageFlagUrl: [
            'https://flagcdn.com/dk.svg',
            'https://flagcdn.com/mk.svg',
            'https://flagcdn.com/cz.svg',
            'https://flagcdn.com/ie.svg'
        ]
    },

    // --- GRUPO B ---
    { id: 'can', name: 'Canadá', code: 'ca', flagUrl: 'https://flagcdn.com/ca.svg' },
    { id: 'qat', name: 'Catar', code: 'qa', flagUrl: 'https://flagcdn.com/qa.svg' },
    { id: 'sui', name: 'Suiza', code: 'ch', flagUrl: 'https://flagcdn.com/ch.svg' },
    {
        id: 'rep_b1',
        name: 'Italia/Nigeria/Gales/Bosnia',
        repechageFlagUrl: [
            'https://flagcdn.com/it.svg',
            'https://flagcdn.com/ng.svg',
            'https://flagcdn.com/gb-wls.svg',
            'https://flagcdn.com/ba.svg'
        ]
    },

    // --- GRUPO C ---
    { id: 'bra', name: 'Brasil', code: 'br', flagUrl: 'https://flagcdn.com/br.svg' },
    { id: 'mar', name: 'Marruecos', code: 'ma', flagUrl: 'https://flagcdn.com/ma.svg' },
    { id: 'hai', name: 'Haití', code: 'ht', flagUrl: 'https://flagcdn.com/ht.svg' },
    { id: 'sco', name: 'Escocia', code: 'gb-sct', flagUrl: 'https://flagcdn.com/gb-sct.svg' },

    // --- GRUPO D ---
    { id: 'usa', name: 'Estados Unidos', code: 'us', flagUrl: 'https://flagcdn.com/us.svg' },
    { id: 'par', name: 'Paraguay', code: 'py', flagUrl: 'https://flagcdn.com/py.svg' },
    { id: 'aus', name: 'Australia', code: 'au', flagUrl: 'https://flagcdn.com/au.svg' },
    {
        id: 'rep_d1',
        name: 'Turquía/Rumania/Eslovaquia/Kosovo',
        repechageFlagUrl: [
            'https://flagcdn.com/tr.svg',
            'https://flagcdn.com/ro.svg',
            'https://flagcdn.com/sk.svg',
            'https://flagcdn.com/xk.svg'
        ]
    },

    // --- GRUPO E ---
    { id: 'ger', name: 'Alemania', code: 'de', flagUrl: 'https://flagcdn.com/de.svg' },
    { id: 'cuw', name: 'Curazao', code: 'cw', flagUrl: 'https://flagcdn.com/cw.svg' },
    { id: 'civ', name: 'Costa de Marfil', code: 'ci', flagUrl: 'https://flagcdn.com/ci.svg' },
    { id: 'ecu', name: 'Ecuador', code: 'ec', flagUrl: 'https://flagcdn.com/ec.svg' },

    // --- GRUPO F ---
    { id: 'ned', name: 'Países Bajos', code: 'nl', flagUrl: 'https://flagcdn.com/nl.svg' },
    { id: 'jpn', name: 'Japón', code: 'jp', flagUrl: 'https://flagcdn.com/jp.svg' },
    { id: 'tun', name: 'Túnez', code: 'tn', flagUrl: 'https://flagcdn.com/tn.svg' },
    {
        id: 'rep_f1',
        name: 'Ucrania/Suecia/Polonia/Albania',
        repechageFlagUrl: [
            'https://flagcdn.com/ua.svg',
            'https://flagcdn.com/se.svg',
            'https://flagcdn.com/pl.svg',
            'https://flagcdn.com/al.svg'
        ]
    },

    // --- GRUPO G ---
    { id: 'bel', name: 'Bélgica', code: 'be', flagUrl: 'https://flagcdn.com/be.svg' },
    { id: 'egy', name: 'Egipto', code: 'eg', flagUrl: 'https://flagcdn.com/eg.svg' },
    { id: 'irn', name: 'Irán', code: 'ir', flagUrl: 'https://flagcdn.com/ir.svg' },
    { id: 'nzl', name: 'Nueva Zelanda', code: 'nz', flagUrl: 'https://flagcdn.com/nz.svg' },

    // --- GRUPO H ---
    { id: 'esp', name: 'España', code: 'es', flagUrl: 'https://flagcdn.com/es.svg' },
    { id: 'cpv', name: 'Cabo Verde', code: 'cv', flagUrl: 'https://flagcdn.com/cv.svg' },
    { id: 'ksa', name: 'Arabia Saudí', code: 'sa', flagUrl: 'https://flagcdn.com/sa.svg' },
    { id: 'uru', name: 'Uruguay', code: 'uy', flagUrl: 'https://flagcdn.com/uy.svg' },

    // --- GRUPO I ---
    { id: 'fra', name: 'Francia', code: 'fr', flagUrl: 'https://flagcdn.com/fr.svg' },
    { id: 'sen', name: 'Senegal', code: 'sn', flagUrl: 'https://flagcdn.com/sn.svg' },
    { id: 'nor', name: 'Noruega', code: 'no', flagUrl: 'https://flagcdn.com/no.svg' },
    {
        id: 'rep_i1',
        name: 'Irak/Bolivia/Surinam',
        repechageFlagUrl: [
            'https://flagcdn.com/iq.svg',
            'https://flagcdn.com/bo.svg',
            'https://flagcdn.com/sr.svg'
        ]
    },

    // --- GRUPO J ---
    { id: 'arg', name: 'Argentina', code: 'ar', flagUrl: 'https://flagcdn.com/ar.svg' },
    { id: 'alg', name: 'Argelia', code: 'dz', flagUrl: 'https://flagcdn.com/dz.svg' },
    { id: 'aut', name: 'Austria', code: 'at', flagUrl: 'https://flagcdn.com/at.svg' },
    { id: 'jor', name: 'Jordania', code: 'jo', flagUrl: 'https://flagcdn.com/jo.svg' },

    // --- GRUPO K ---
    { id: 'por', name: 'Portugal', code: 'pt', flagUrl: 'https://flagcdn.com/pt.svg' },
    { id: 'uzb', name: 'Uzbekistán', code: 'uz', flagUrl: 'https://flagcdn.com/uz.svg' },
    { id: 'col', name: 'Colombia', code: 'co', flagUrl: 'https://flagcdn.com/co.svg' },
    {
        id: 'rep_k1',
        name: 'Jamaica/RD Congo/N. Caledonia',
        repechageFlagUrl: [
            'https://flagcdn.com/jm.svg',
            'https://flagcdn.com/cd.svg',
            'https://flagcdn.com/nc.svg'
        ]
    },

    // --- GRUPO L ---
    { id: 'eng', name: 'Inglaterra', code: 'gb-eng', flagUrl: 'https://flagcdn.com/gb-eng.svg' },
    { id: 'cro', name: 'Croacia', code: 'hr', flagUrl: 'https://flagcdn.com/hr.svg' },
    { id: 'gha', name: 'Ghana', code: 'gh', flagUrl: 'https://flagcdn.com/gh.svg' },
    { id: 'pan', name: 'Panamá', code: 'pa', flagUrl: 'https://flagcdn.com/pa.svg' }
];
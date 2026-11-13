// Sources réelles et dictionnaires de classement.
// Pour ajouter une source : une ligne ici (ou dans sources.local.json, voir docs/SOURCES-ET-ALERTES.md).
import fs from 'node:fs';

// kind : officiel (autorité publique), editeur, recherche, presse, donnees (API structurée)
export const SOURCES = [
  { id: 'cisa-kev', name: 'CISA KEV', org: 'CISA', kind: 'donnees', format: 'kev', site: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    urls: ['https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
           'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json'] },
  { id: 'nvd', name: 'NVD', org: 'NIST', kind: 'donnees', format: 'nvd', site: 'https://nvd.nist.gov', urls: ['https://services.nvd.nist.gov/rest/json/cves/2.0'] },
  { id: 'epss', name: 'EPSS', org: 'FIRST', kind: 'donnees', format: 'epss', site: 'https://www.first.org/epss', urls: ['https://api.first.org/data/v1/epss'] },

  { id: 'certfr-alerte', name: 'CERT-FR — Alertes', org: 'CERT-FR', kind: 'officiel', role: 'alerte', lang: 'fr', site: 'https://www.cert.ssi.gouv.fr', urls: ['https://www.cert.ssi.gouv.fr/alerte/feed/'] },
  { id: 'certfr-avis', name: 'CERT-FR — Avis', org: 'CERT-FR', kind: 'officiel', role: 'avis', lang: 'fr', site: 'https://www.cert.ssi.gouv.fr', urls: ['https://www.cert.ssi.gouv.fr/avis/feed/'] },
  { id: 'certfr-cti', name: 'CERT-FR — Menaces et incidents', org: 'CERT-FR', kind: 'officiel', lang: 'fr', site: 'https://www.cert.ssi.gouv.fr', urls: ['https://www.cert.ssi.gouv.fr/cti/feed/'] },
  { id: 'certfr-actu', name: 'CERT-FR — Bulletins d’actualité', org: 'CERT-FR', kind: 'officiel', lang: 'fr', site: 'https://www.cert.ssi.gouv.fr', urls: ['https://www.cert.ssi.gouv.fr/actualite/feed/'] },
  { id: 'anssi', name: 'ANSSI — Actualités', org: 'ANSSI', kind: 'officiel', lang: 'fr', site: 'https://cyber.gouv.fr', urls: ['https://cyber.gouv.fr/actualites/rss/', 'https://cyber.gouv.fr/en/news/rss/'] },
  { id: 'cisa-adv', name: 'CISA — Advisories', org: 'CISA', kind: 'officiel', role: 'avis', lang: 'en', site: 'https://www.cisa.gov', urls: ['https://www.cisa.gov/cybersecurity-advisories/all.xml'] },
  { id: 'cisa-news', name: 'CISA — News', org: 'CISA', kind: 'officiel', lang: 'en', site: 'https://www.cisa.gov', urls: ['https://www.cisa.gov/news.xml'] },
  { id: 'enisa', name: 'ENISA — News', org: 'ENISA', kind: 'officiel', lang: 'en', site: 'https://www.enisa.europa.eu', html: '^(https://www\\.enisa\\.europa\\.eu)?/news/[a-z0-9-]{12,}$', urls: ['https://www.enisa.europa.eu/news'] },
  { id: 'certeu-adv', name: 'CERT-EU — Security Advisories', org: 'CERT-EU', kind: 'officiel', role: 'avis', lang: 'en', site: 'https://cert.europa.eu', urls: ['https://cert.europa.eu/publications/security-advisories-rss'] },
  { id: 'certeu-ti', name: 'CERT-EU — Threat Intelligence', org: 'CERT-EU', kind: 'officiel', lang: 'en', site: 'https://cert.europa.eu', urls: ['https://cert.europa.eu/publications/threat-intelligence-rss'] },
  { id: 'ncsc-uk', name: 'NCSC UK', org: 'NCSC', kind: 'officiel', lang: 'en', site: 'https://www.ncsc.gov.uk', urls: ['https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml'] },

  // Maroc. « country » rattache d'office les publications de la source à ce pays.
  { id: 'dgssi', name: 'DGSSI — Bulletins de sécurité (maCERT)', org: 'DGSSI', kind: 'officiel', role: 'avis', lang: 'fr', country: 'MA', site: 'https://www.dgssi.gov.ma', html: '^(https://www\\.dgssi\\.gov\\.ma)?/fr/bulletins/[^/]{8,}$', max: 15, urls: ['https://www.dgssi.gov.ma/fr/bulletins'] },
  { id: 'gnews-ma', name: 'Presse marocaine — cybersécurité (Google Actualités)', org: 'Google Actualités', kind: 'presse', lang: 'fr', max: 30, filter: 'cyber|pirat|hack|fuite|rançon|ransom|DGSSI|données|phishing|hameçon|vulnérabilit',
    urls: ['https://news.google.com/rss/search?q=Maroc+(cyberattaque+OR+piratage+OR+%22fuite+de+donn%C3%A9es%22+OR+ran%C3%A7ongiciel+OR+DGSSI)+when:7d&hl=fr&gl=MA&ceid=MA:fr'] },
  { id: 'rlive-ma', name: 'Revendications de rançongiciels — Maroc (ransomware.live)', org: 'ransomware.live', kind: 'suivi', lang: 'fr', country: 'MA', rlive: true, site: 'https://www.ransomware.live', urls: ['https://api.ransomware.live/v2/countryvictims/MA'] },
  // Signaux précoces : ce que les CERT nationaux relaient souvent un à deux jours plus tard
  { id: 'sans-isc', name: 'SANS Internet Storm Center', org: 'SANS ISC', kind: 'recherche', lang: 'en', site: 'https://isc.sans.edu', urls: ['https://isc.sans.edu/rssfeed_full.xml'] },
  { id: 'chrome', name: 'Chrome Releases', org: 'Google', kind: 'editeur', role: 'avis', lang: 'en', site: 'https://chromereleases.googleblog.com', max: 20, urls: ['https://chromereleases.googleblog.com/feeds/posts/default'] },
  { id: 'wordfence', name: 'Wordfence', org: 'Wordfence', kind: 'recherche', lang: 'en', site: 'https://www.wordfence.com/blog', urls: ['https://www.wordfence.com/feed/'] },

  { id: 'msrc', name: 'Microsoft MSRC', org: 'Microsoft', kind: 'editeur', role: 'avis', lang: 'en', site: 'https://msrc.microsoft.com', urls: ['https://api.msrc.microsoft.com/update-guide/rss'] },
  { id: 'cisco', name: 'Cisco PSIRT', org: 'Cisco', kind: 'editeur', role: 'avis', lang: 'en', site: 'https://sec.cloudapps.cisco.com', urls: ['https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml'] },
  { id: 'fortinet', name: 'Fortinet PSIRT', org: 'Fortinet', kind: 'editeur', role: 'avis', lang: 'en', site: 'https://www.fortiguard.com/psirt', urls: ['https://filestore.fortinet.com/fortiguard/rss/ir.xml'] },
  { id: 'paloalto', name: 'Palo Alto Networks — Advisories', org: 'Palo Alto Networks', kind: 'editeur', role: 'avis', lang: 'en', site: 'https://security.paloaltonetworks.com', urls: ['https://security.paloaltonetworks.com/rss.xml'] },
  { id: 'ms-secblog', name: 'Microsoft Security Blog', org: 'Microsoft', kind: 'editeur', lang: 'en', site: 'https://www.microsoft.com/security/blog', urls: ['https://www.microsoft.com/en-us/security/blog/feed/'] },

  { id: 'talos', name: 'Cisco Talos', org: 'Cisco Talos', kind: 'recherche', lang: 'en', site: 'https://blog.talosintelligence.com', urls: ['https://blog.talosintelligence.com/rss/'] },
  { id: 'unit42', name: 'Unit 42', org: 'Palo Alto Networks', kind: 'recherche', lang: 'en', site: 'https://unit42.paloaltonetworks.com', urls: ['https://unit42.paloaltonetworks.com/feed/'] },
  { id: 'securelist', name: 'Securelist', org: 'Kaspersky', kind: 'recherche', lang: 'en', site: 'https://securelist.com', urls: ['https://securelist.com/feed/'] },
  { id: 'p0', name: 'Google Project Zero', org: 'Google', kind: 'recherche', lang: 'en', site: 'https://googleprojectzero.blogspot.com', urls: ['https://googleprojectzero.blogspot.com/feeds/posts/default'] },
  { id: 'sekoia', name: 'Sekoia.io — Blog', org: 'Sekoia.io', kind: 'recherche', lang: 'en', site: 'https://blog.sekoia.io', urls: ['https://blog.sekoia.io/feed/'] },

  { id: 'bleeping', name: 'BleepingComputer', org: 'BleepingComputer', kind: 'presse', lang: 'en', site: 'https://www.bleepingcomputer.com', urls: ['https://www.bleepingcomputer.com/feed/'] },
  { id: 'therecord', name: 'The Record', org: 'Recorded Future News', kind: 'presse', lang: 'en', site: 'https://therecord.media', urls: ['https://therecord.media/feed'] },
  { id: 'securityweek', name: 'SecurityWeek', org: 'SecurityWeek', kind: 'presse', lang: 'en', site: 'https://www.securityweek.com', urls: ['https://www.securityweek.com/feed/'] },
  { id: 'thn', name: 'The Hacker News', org: 'The Hacker News', kind: 'presse', lang: 'en', site: 'https://thehackernews.com', urls: ['https://feeds.feedburner.com/TheHackersNews'] },
  { id: 'zataz', name: 'ZATAZ', org: 'ZATAZ', kind: 'presse', lang: 'fr', site: 'https://www.zataz.com', urls: ['https://www.zataz.com/feed/'] },
];
try {
  const extra = JSON.parse(fs.readFileSync(new URL('../sources.local.json', import.meta.url), 'utf8'));
  for (const s of extra) { const i = SOURCES.findIndex(x => x.id === s.id); if (i >= 0) SOURCES[i] = { ...SOURCES[i], ...s }; else SOURCES.push(s); }
} catch { /* fichier facultatif */ }

export const KIND_LABEL = { officiel: 'autorité publique', editeur: 'éditeur', recherche: 'équipe de recherche', presse: 'presse spécialisée', donnees: 'base de données' };

// Type d'événement : premier motif reconnu (ordre = priorité).
export const TYPES = [
  ['rancongiciel', /\b(ransomware|rançongiciel|rancongiciel|ransom gang|extortion|double[- ]extorsion|lockbit|akira|qilin|ransomhub)\b/i],
  ['fuite', /\b(data breach|data leak|breach(es|ed)?|leak(s|ed)?|fuite de données|fuites? d[’']informations|données personnelles|exposed (data|records)|stolen data|vol de données|exfiltrat)/i],
  ['phishing', /\b(phishing|hameçonnage|hameconnage|smishing|vishing|spear[- ]phishing|quishing|business email compromise|BEC)\b/i],
  ['panne', /\b(outages?|pannes?|hors service|service disruptions?|disrupts? (services?|access|operations|email)|perturbations?|interruption de service|went down|is down|down for (users|millions|hours)|inaccessible|indisponible)\b/i],
  ['infra', /\b(critical infrastructure|infrastructures? critiques?|ICS|SCADA|OT network|industrial control|power grid|water (utility|treatment|system)|pipeline|opérateurs? d[’']importance vitale|OIV)\b/i],
  ['cloud', /\b(cloud|AWS|Azure|GCP|Google Cloud|S3 bucket|Kubernetes|SaaS|Snowflake|Okta|tenant|Entra ID|Microsoft 365)\b/i],
  ['incident', /\b(cyber ?attack|cyberattaque|cyber-attaque|hack(ed|ers?)?|intrusion|compromis(e|ed)?|compromission|outage after|DDoS|déni de service|malware campaign|espionage|espionnage|supply[- ]chain attack|zero-day attacks?|exploited in (the wild|attacks))\b/i],
  ['maj', /\b(patch tuesday|security updates?|mises? à jour de sécurité|correctifs?|patch(es|ed)?|fix(es|ed)? (flaw|bug|vulnerab)|multiples? vulnérabilités|vulnérabilité dans|advisory|bulletin)\b/i],
  ['norme', /\b(NIS ?2|DORA|cyber resilience act|CRA|référentiel|guide|guidance|framework|standard|norme|ISO ?27001|recommandations?|best practices|bonnes pratiques|réglementation|regulation|directive|post-quantum|secure by design)\b/i],
  ['recherche', /\b(research|researchers?|analysis|analyse|rapport|report|threat (landscape|intelligence)|panorama|étude|deep dive|technical analysis|proof[- ]of[- ]concept)\b/i],
];
export const INCIDENT_TYPES = new Set(['rancongiciel', 'fuite', 'phishing', 'panne', 'infra', 'cloud', 'incident']);

export const SECTORS = [
  ['Santé', /\b(hospital|hôpita(l|ux)|healthcare|health system|clinic|clinique|CHU|medical|NHS|patient|pharma|santé)\b/i],
  ['Énergie', /\b(energy|énergie|power (grid|plant|utility)|electric|électri|oil|gas|pipeline|nuclear|nucléaire)\b/i],
  ['Finance', /\b(bank|banque|financial|financ|insurance|assurance|crypto exchange|fintech|credit union|payment)\b/i],
  ['Éducation', /\b(university|université|school|école|college|lycée|education|éducation|campus)\b/i],
  ['Administration', /\b(government|gouvernement|ministry|ministère|municipal|city of|county|mairie|collectivité|public sector|agency|agence nationale|parliament|parlement)\b/i],
  ['Transport', /\b(airline|airport|aéroport|rail (operator|network|service)s?|ferroviaire|shipping|port of|logistics|logistique|aviation|transports?)\b/i],
  ['Télécoms', /\b(telecom|télécom|carrier|mobile operator|opérateur|ISP|broadband)\b/i],
  ['Industrie', /\b(manufactur|industrial|industriel|factory|usine|automotive|automobile|aerospace|aéronautique)\b/i],
  ['Commerce', /\b(retail|retailer|e-commerce|supermarket|distribution|store chain|enseigne)\b/i],
  ['Technologie', /\b(software (company|vendor|maker)|éditeur de logiciels|SaaS provider|tech (giant|company|firm)|hosting provider|hébergeur|MSP|managed service)\b/i],
  ['Défense', /\b(defense contractor|defence|défense|military|militaire|army|armée|navy)\b/i],
  ['Eau', /\b(water (utility|treatment|system|supply)|eau potable|wastewater|assainissement)\b/i],
  ['Médias', /\b(newspaper|broadcaster|media (group|company)|médias?|television|télévision|radio)\b/i],
];

// Pays : [code, nom FR, lat, lon, motif]. Seules les mentions explicites dans les sources sont retenues.
export const COUNTRIES = [
  ['FR', 'France', 46.6, 2.4, /\b(France|French|français[e]?s?|Paris)\b/], ['US', 'États-Unis', 39.8, -98.6, /\b(United States|U\.S\.|USA|US-based|American|États-Unis|américain[e]?s?)\b/],
  ['GB', 'Royaume-Uni', 54.0, -2.0, /\b(United Kingdom|UK|British|Britain|Royaume-Uni|britannique|England|Scotland|London)\b/], ['DE', 'Allemagne', 51.2, 10.4, /\b(Germany|German|Allemagne|allemand[e]?s?|Berlin)\b/],
  ['ES', 'Espagne', 40.2, -3.6, /\b(Spain|Spanish|Espagne|espagnol[e]?s?|Madrid)\b/], ['IT', 'Italie', 42.8, 12.6, /\b(Italy|Italian|Italie|italien(ne)?s?|Rome|Milan)\b/],
  ['NL', 'Pays-Bas', 52.2, 5.3, /\b(Netherlands|Dutch|Pays-Bas|néerlandais[e]?s?)\b/], ['BE', 'Belgique', 50.6, 4.6, /\b(Belgium|Belgian|Belgique|belges?|Brussels|Bruxelles)\b/],
  ['CH', 'Suisse', 46.8, 8.2, /\b(Switzerland|Swiss|Suisse)\b/], ['SE', 'Suède', 62.0, 15.0, /\b(Sweden|Swedish|Suède|suédois[e]?s?)\b/],
  ['NO', 'Norvège', 61.0, 9.0, /\b(Norway|Norwegian|Norvège)\b/], ['DK', 'Danemark', 56.0, 9.5, /\b(Denmark|Danish|Danemark|danois[e]?s?)\b/],
  ['FI', 'Finlande', 64.0, 26.0, /\b(Finland|Finnish|Finlande)\b/], ['PL', 'Pologne', 52.1, 19.4, /\b(Poland|Polish|Pologne|polonais[e]?s?)\b/],
  ['UA', 'Ukraine', 49.0, 31.4, /\b(Ukraine|Ukrainian|ukrainien(ne)?s?|Kyiv)\b/], ['RU', 'Russie', 60.0, 90.0, /\b(Russia|Russian|Russie|russes?|Moscow|Kremlin)\b/],
  ['CN', 'Chine', 35.0, 103.8, /\b(China|Chinese|Chine|chinois[e]?s?|Beijing)\b/], ['JP', 'Japon', 36.2, 138.3, /\b(Japan|Japanese|Japon|japonais[e]?s?|Tokyo)\b/],
  ['KR', 'Corée du Sud', 36.5, 127.9, /\b(South Korea|South Korean|Corée du Sud|sud-coréen(ne)?s?|Seoul)\b/], ['KP', 'Corée du Nord', 40.3, 127.4, /\b(North Korea|North Korean|Corée du Nord|nord-coréen(ne)?s?|DPRK)\b/],
  ['IN', 'Inde', 21.0, 78.9, /\b(India|Indian|Inde|indien(ne)?s?)\b/], ['AU', 'Australie', -25.3, 133.8, /\b(Australia|Australian|Australie|australien(ne)?s?)\b/],
  ['NZ', 'Nouvelle-Zélande', -41.0, 174.0, /\b(New Zealand|Nouvelle-Zélande)\b/], ['CA', 'Canada', 56.1, -106.3, /\b(Canada|Canadian|canadien(ne)?s?)\b/],
  ['MX', 'Mexique', 23.6, -102.5, /\b(Mexico|Mexican|Mexique)\b/], ['BR', 'Brésil', -10.8, -53.0, /\b(Brazil|Brazilian|Brésil|brésilien(ne)?s?)\b/],
  ['AR', 'Argentine', -34.0, -64.0, /\b(Argentina|Argentine)\b/], ['CL', 'Chili', -33.5, -70.7, /\b(Chile|Chilean|Chili)\b/], ['CO', 'Colombie', 4.6, -74.1, /\b(Colombia|Colombian|Colombie)\b/],
  ['IL', 'Israël', 31.4, 35.0, /\b(Israel|Israeli|Israël|israélien(ne)?s?)\b/], ['IR', 'Iran', 32.4, 53.7, /\b(Iran|Iranian|iranien(ne)?s?|Tehran)\b/],
  ['SA', 'Arabie saoudite', 24.0, 45.0, /\b(Saudi Arabia|Saudi|Arabie saoudite)\b/], ['AE', 'Émirats arabes unis', 24.0, 54.0, /\b(UAE|United Arab Emirates|Émirats|Dubai|Abu Dhabi)\b/],
  ['TR', 'Turquie', 39.0, 35.2, /\b(Turkey|Türkiye|Turkish|Turquie|turc|turque)\b/], ['EG', 'Égypte', 26.8, 30.8, /\b(Egypt|Egyptian|Égypte)\b/],
  ['MA', 'Maroc', 31.8, -7.1, /\b(Morocco|Moroccan|Maroc|marocain[e]?s?|Rabat|Casablanca|Marrakech|Tanger|DGSSI|maCERT)\b/], ['DZ', 'Algérie', 28.0, 1.7, /\b(Algeria|Algerian|Algérie)\b/], ['TN', 'Tunisie', 34.0, 9.5, /\b(Tunisia|Tunisian|Tunisie)\b/],
  ['ZA', 'Afrique du Sud', -30.6, 22.9, /\b(South Africa|South African|Afrique du Sud)\b/], ['NG', 'Nigeria', 9.1, 8.7, /\b(Nigeria|Nigerian)\b/], ['KE', 'Kenya', -0.0, 37.9, /\b(Kenya|Kenyan)\b/],
  ['SG', 'Singapour', 1.35, 103.8, /\b(Singapore|Singapour)\b/], ['TW', 'Taïwan', 23.7, 121.0, /\b(Taiwan|Taiwanese|Taïwan)\b/], ['VN', 'Viêt Nam', 14.1, 108.3, /\b(Vietnam|Vietnamese|Viêt Nam)\b/],
  ['ID', 'Indonésie', -0.8, 113.9, /\b(Indonesia|Indonesian|Indonésie)\b/], ['MY', 'Malaisie', 4.2, 102.0, /\b(Malaysia|Malaysian|Malaisie)\b/], ['TH', 'Thaïlande', 15.9, 101.0, /\b(Thailand|Thai|Thaïlande)\b/],
  ['PH', 'Philippines', 12.9, 121.8, /\b(Philippines|Philippine|Filipino)\b/], ['PK', 'Pakistan', 30.4, 69.3, /\b(Pakistan|Pakistani)\b/],
  ['IE', 'Irlande', 53.4, -8.2, /\b(Ireland|Irish|Irlande)\b/], ['PT', 'Portugal', 39.4, -8.2, /\b(Portugal|Portuguese|portugais[e]?s?)\b/], ['AT', 'Autriche', 47.5, 14.6, /\b(Austria|Austrian|Autriche)\b/],
  ['CZ', 'Tchéquie', 49.8, 15.5, /\b(Czech|Czechia|Tchéquie|tchèque)\b/], ['RO', 'Roumanie', 45.9, 25.0, /\b(Romania|Romanian|Roumanie)\b/], ['GR', 'Grèce', 39.1, 21.8, /\b(Greece|Greek|Grèce)\b/],
  ['EE', 'Estonie', 58.6, 25.0, /\b(Estonia|Estonian|Estonie)\b/], ['LT', 'Lituanie', 55.2, 23.9, /\b(Lithuania|Lithuanian|Lituanie)\b/], ['LU', 'Luxembourg', 49.8, 6.1, /\b(Luxembourg)\b/],
];

// Groupes fréquemment cités. La mention seule ne vaut jamais attribution : le niveau de confiance est calculé à part.
export const ACTORS = /\b(LockBit|Akira|Cl0p|Clop|Qilin|Play ransomware|BlackCat|ALPHV|Black Basta|Medusa|RansomHub|Scattered Spider|Lazarus|Sandworm|Volt Typhoon|Salt Typhoon|Silk Typhoon|Flax Typhoon|ShinyHunters|Rhysida|INC Ransom|Hunters International|DragonForce|Kimsuky|MuddyWater|Turla|FIN7|FIN11|Fancy Bear|Cozy Bear|Midnight Blizzard|Lapsus\$|BlackSuit|Interlock|SafePay|Everest|NoName057\(16\)|Killnet|APT\d{1,2}|UNC\d{3,5}|TA\d{3,4}|Storm-\d{4})\b/;

export const TECHS = ['Microsoft', 'Windows', 'Exchange', 'SharePoint', 'Microsoft 365', 'Azure', 'Active Directory', 'Cisco', 'Fortinet', 'FortiGate', 'FortiOS', 'Palo Alto', 'PAN-OS', 'Ivanti', 'Citrix', 'NetScaler', 'VMware', 'ESXi', 'vCenter', 'SonicWall', 'Juniper', 'F5', 'BIG-IP', 'Check Point', 'Zyxel', 'Apple', 'iOS', 'macOS', 'Android', 'Chrome', 'Firefox', 'Linux', 'Kubernetes', 'Docker', 'AWS', 'Google Cloud', 'Oracle', 'SAP', 'Atlassian', 'Confluence', 'Jira', 'GitLab', 'GitHub', 'Jenkins', 'WordPress', 'Apache', 'Nginx', 'OpenSSH', 'OpenSSL', 'PHP', 'Veeam', 'Zimbra', 'Roundcube', 'Okta', 'Snowflake', 'Salesforce', 'ServiceNow', 'Synology', 'QNAP', 'D-Link', 'TP-Link', 'Zoho', 'ManageEngine', 'SolarWinds', 'ConnectWise', 'Progress', 'MOVEit', 'CrushFTP', 'Cleo', 'Commvault', 'Trend Micro', 'CrowdStrike', 'Sophos', 'Sitecore', 'Adobe', 'Samsung', 'Qualcomm', 'Siemens', 'Schneider Electric', 'Rockwell', 'Redis', 'PostgreSQL', 'npm', 'PyPI'];

export const RX = {
  cve: /CVE-\d{4}-\d{4,7}/gi,
  attack: /\bT1\d{3}(?:\.\d{3})?\b/g,
  confirm: /\b(confirm(s|ed)?|confirme|a confirmé|acknowledg(es|ed)|disclos(es|ed)|notif(ies|ied|ying)|8-K|filing with|a reconnu|a annoncé avoir été victime|says it was (breached|hacked))\b/i,
  claim: /\b(claims?|claimed|revendiqu|takes credit|took credit|leak site|listed on|alleg(es|ed|edly)|prétend|affirme avoir)\b/i,
  // une panne « sans cyberattaque » n'est pas un démenti de la panne
  noattack: /(no (sign|evidence|indication)s? of (a |any )?(malicious|cyber ?attack|attack|hack)|not (the result of |caused by )?a cyber ?attack|pas de cyberattaque|aucun signe d[’']action malveillante|aucune cyberattaque|pas d[’']attaque|n[’']est pas une cyberattaque|non liée? à une cyberattaque|écart\w* la piste)/i,
  attackword: /\b(cyber ?attacks?|cyberattaques?|hack(ed|ers?)|intrusion|DDoS|déni de service|malicious|malveillante?)\b/i,
  panneack: /\b(says?|said|confirm\w*|acknowledg\w*|investigating|mitigat\w*|restor\w*|resolved|selon|assure|reconna[iî]t|a reconnu|rétabli\w*|enquête|status page)\b/i,
  global: /\b(mondiale?s?|monde entier|worldwide|global(ly)?|international(e|es|ly)?|plusieurs pays|across the world)\b/i,
  deny: /\b(den(y|ies|ied)|dément|a démenti|disputes?|refutes?|no evidence of|conteste|réfute)\b/i,
};

export const env = (k, d) => process.env[k] ?? d;

import type { Cursus, Leerdoel, Rubric } from "./types";

/**
 * Curriculum-seed voor de eerste graad, overgenomen uit het papieren badgeboek
 * (zie docs/reference/badgeboek-1e-graad-A.md). Voorlopig enkel de cursussen die
 * het prototype nodig heeft: Basisvaardigheden en Vrije Tekst.
 *
 * Structuur: Cursus → Rubric → Leerdoel. Alle doelen hier zijn 'standaard'.
 */

export const cursussen: Cursus[] = [
  { id: "c-basis", naam: "Basisvaardigheden", graad: 1 },
  { id: "c-vrije-tekst", naam: "Vrije Tekst", graad: 1 },
];

export const rubrics: Rubric[] = [
  // Basisvaardigheden
  { id: "r-welbevinden", cursusId: "c-basis", naam: "Algemeen welbevinden" },
  { id: "r-motivatie", cursusId: "c-basis", naam: "Intrinsieke motivatie" },
  { id: "r-zelfsturing", cursusId: "c-basis", naam: "Zelfsturing" },
  { id: "r-planning", cursusId: "c-basis", naam: "Planning" },
  { id: "r-afwerking", cursusId: "c-basis", naam: "Afwerking" },
  { id: "r-feedback", cursusId: "c-basis", naam: "Omgaan met feedback" },
  { id: "r-reflectie", cursusId: "c-basis", naam: "Reflectie" },
  { id: "r-cooperatie", cursusId: "c-basis", naam: "Coöperatie" },
  { id: "r-betrokkenheid", cursusId: "c-basis", naam: "Betrokkenheid" },
  // Vrije Tekst
  { id: "r-vt-kerndoelen", cursusId: "c-vrije-tekst", naam: "Kerndoelen" },
];

export const leerdoelen: Leerdoel[] = [
  // Algemeen welbevinden
  d("d-wb-1", "r-welbevinden", "Je komt graag naar school."),
  d("d-wb-2", "r-welbevinden", "Je ervaart school als een veilige plaats."),
  d("d-wb-3", "r-welbevinden", "Je voelt je gesteund door mentoren en/of peers."),
  d("d-wb-4", "r-welbevinden", "Je durft jezelf te zijn."),

  // Intrinsieke motivatie
  d("d-mo-1", "r-motivatie", "Je bent gemotiveerd."),
  d("d-mo-2", "r-motivatie", "Je kan anderen motiveren."),

  // Zelfsturing
  d("d-zs-1", "r-zelfsturing", "Je bent zelfredzaam."),
  d("d-zs-2", "r-zelfsturing", "Je kan problemen oplossingsgericht aanpakken."),
  d(
    "d-zs-3",
    "r-zelfsturing",
    "Taakspanning: je kan doelen bepalen, een opdracht beginnen, volhouden, afwerken en reflecteren.",
  ),

  // Planning
  d("d-pl-1", "r-planning", "Je kan een plan opstellen."),
  d("d-pl-2", "r-planning", "Je kan een plan uitvoeren en aanpassen indien nodig."),
  d("d-pl-3", "r-planning", "Je kan opdrachten plannen."),
  d("d-pl-4", "r-planning", "Je maakt actief gebruik van het badgeboek."),

  // Afwerking
  d("d-aw-1", "r-afwerking", "Je komt tot afwerking (volgens de doelen)."),
  d(
    "d-aw-2",
    "r-afwerking",
    "Je streeft naar iets waar je trots op bent (zone van de naaste ontwikkeling).",
  ),

  // Omgaan met feedback
  d("d-fb-1", "r-feedback", "Je kan omgaan met feedback van mentoren."),
  d("d-fb-2", "r-feedback", "Je kan omgaan met feedback van leeftijdsgenoten."),
  d("d-fb-3", "r-feedback", "Je kan zelf feedback geven."),

  // Reflectie
  d(
    "d-rf-1",
    "r-reflectie",
    "Je kan reflecteren over je leerproces, je studiehouding, je kwaliteiten en je werkpunten.",
  ),
  d("d-rf-2", "r-reflectie", "Je weet hoe je het best leert/werkt."),
  d("d-rf-3", "r-reflectie", "Je kent je eigen sterktes en talenten."),

  // Coöperatie
  d(
    "d-co-1",
    "r-cooperatie",
    "Je hebt een respectvolle houding (vanuit gelijkwaardigheid en empathie).",
  ),
  d("d-co-2", "r-cooperatie", "Je neemt je verantwoordelijkheid binnen de groep."),
  d("d-co-3", "r-cooperatie", "Je formuleert en respecteert afspraken."),

  // Betrokkenheid
  d("d-bt-1", "r-betrokkenheid", "Je bouwt actief mee aan de klasgroep en de school."),
  d("d-bt-2", "r-betrokkenheid", "Je zoekt naar oplossingen voor conflicten en problemen."),

  // Vrije Tekst — kerndoelen
  d("d-vt-1", "r-vt-kerndoelen", "Je bent gemotiveerd om te schrijven."),
  d("d-vt-2", "r-vt-kerndoelen", "Je hebt oog voor tekstsamenhang."),
  d("d-vt-3", "r-vt-kerndoelen", "Je varieert je schrijven (genres, talen, registers)."),
  d("d-vt-4", "r-vt-kerndoelen", "Je verzorgt je geschreven taal."),
];

function d(
  id: string,
  rubricId: string,
  omschrijving: string,
  categorie: Leerdoel["categorie"] = "standaard",
): Leerdoel {
  return { id, rubricId, omschrijving, categorie };
}

// --- Afgeleide helpers -------------------------------------------------------

export const rubricsVoorCursus = (cursusId: string): Rubric[] =>
  rubrics.filter((r) => r.cursusId === cursusId);

export const leerdoelenVoorRubric = (rubricId: string): Leerdoel[] =>
  leerdoelen.filter((l) => l.rubricId === rubricId);

export const leerdoelenVoorCursus = (cursusId: string): Leerdoel[] => {
  const rubricIds = new Set(rubricsVoorCursus(cursusId).map((r) => r.id));
  return leerdoelen.filter((l) => rubricIds.has(l.rubricId));
};

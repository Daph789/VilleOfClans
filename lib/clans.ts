export type Clan = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
};

export const lilleClans: Clan[] = [
  { id: "vieux-lille", name: "Vieux-Lille", tagline: "Patrimoine et tempo régulier", accent: "#3b7a57" },
  { id: "centre", name: "Centre", tagline: "Le cœur de la ville", accent: "#e76f51" },
  { id: "vauban-esquermes", name: "Vauban-Esquermes", tagline: "Campus, parc et longues foulées", accent: "#264653" },
  { id: "wazemmes", name: "Wazemmes", tagline: "Bruyant, vivant, imprévisible", accent: "#f4a261" },
  { id: "moulins", name: "Moulins", tagline: "Endurance et densité", accent: "#6d597a" },
  { id: "fives", name: "Fives", tagline: "L'acier dans les jambes", accent: "#1d3557" },
  { id: "saint-maurice-pellevoisin", name: "Saint-Maurice Pellevoisin", tagline: "Discret mais solide", accent: "#457b9d" },
  { id: "bois-blancs", name: "Bois-Blancs", tagline: "Canal, souffle et relance", accent: "#2a9d8f" },
  { id: "lille-sud", name: "Lille-Sud", tagline: "Progression constante", accent: "#bc4749" },
  { id: "hellemmes", name: "Hellemmes", tagline: "Sprint populaire", accent: "#ff7b00" }
];

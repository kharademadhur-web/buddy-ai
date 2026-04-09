/**
 * Curated formulary subset for /api/medicines/search (offline-first; replace with DB later).
 */
export interface MedicineCatalogEntry {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export const MEDICINES_CATALOG: MedicineCatalogEntry[] = [
  { name: "Paracetamol", dosage: "500mg", frequency: "TDS", duration: "5 days" },
  { name: "Paracetamol", dosage: "650mg", frequency: "SOS", duration: "3 days" },
  { name: "Ibuprofen", dosage: "400mg", frequency: "TDS", duration: "5 days" },
  { name: "Aspirin", dosage: "75mg", frequency: "OD", duration: "30 days" },
  { name: "Amoxicillin", dosage: "500mg", frequency: "TDS", duration: "7 days" },
  { name: "Azithromycin", dosage: "500mg", frequency: "OD", duration: "3 days" },
  { name: "Cefixime", dosage: "200mg", frequency: "BD", duration: "7 days" },
  { name: "Metformin", dosage: "500mg", frequency: "BD", duration: "30 days" },
  { name: "Glimepiride", dosage: "1mg", frequency: "OD", duration: "30 days" },
  { name: "Insulin Glargine", dosage: "10 units", frequency: "OD", duration: "30 days" },
  { name: "Atorvastatin", dosage: "20mg", frequency: "HS", duration: "30 days" },
  { name: "Lisinopril", dosage: "10mg", frequency: "OD", duration: "30 days" },
  { name: "Amlodipine", dosage: "5mg", frequency: "OD", duration: "30 days" },
  { name: "Losartan", dosage: "50mg", frequency: "OD", duration: "30 days" },
  { name: "Metoprolol", dosage: "25mg", frequency: "BD", duration: "30 days" },
  { name: "Omeprazole", dosage: "20mg", frequency: "BD", duration: "14 days" },
  { name: "Pantoprazole", dosage: "40mg", frequency: "OD", duration: "14 days" },
  { name: "Levocetirizine", dosage: "5mg", frequency: "HS", duration: "5 days" },
  { name: "Montelukast", dosage: "10mg", frequency: "HS", duration: "10 days" },
  { name: "Salbutamol inhaler", dosage: "2 puffs", frequency: "SOS", duration: "30 days" },
  { name: "Budesonide inhaler", dosage: "200mcg", frequency: "BD", duration: "30 days" },
  { name: "Levothyroxine", dosage: "50mcg", frequency: "OD", duration: "30 days" },
  { name: "Vitamin D3", dosage: "60k IU", frequency: "Weekly", duration: "8 weeks" },
  { name: "Calcium + Vitamin D", dosage: "500mg", frequency: "BD", duration: "30 days" },
  { name: "Iron + Folic Acid", dosage: "1 tab", frequency: "OD", duration: "30 days" },
  { name: "ORS", dosage: "sachet", frequency: "After each loose stool", duration: "3 days" },
  { name: "Ondansetron", dosage: "4mg", frequency: "SOS", duration: "3 days" },
  { name: "Diclofenac", dosage: "50mg", frequency: "BD", duration: "5 days" },
  { name: "Tramadol", dosage: "50mg", frequency: "SOS", duration: "3 days" },
  { name: "Cetirizine", dosage: "10mg", frequency: "HS", duration: "5 days" },
  { name: "Fexofenadine", dosage: "120mg", frequency: "OD", duration: "5 days" },
  { name: "Clopidogrel", dosage: "75mg", frequency: "OD", duration: "30 days" },
  { name: "Warfarin", dosage: "2mg", frequency: "OD", duration: "30 days" },
  { name: "Furosemide", dosage: "40mg", frequency: "OD", duration: "7 days" },
  { name: "Spironolactone", dosage: "25mg", frequency: "OD", duration: "14 days" },
  { name: "Sertraline", dosage: "50mg", frequency: "OD", duration: "30 days" },
  { name: "Escitalopram", dosage: "10mg", frequency: "OD", duration: "30 days" },
  { name: "Alprazolam", dosage: "0.25mg", frequency: "HS", duration: "7 days" },
  { name: "Multivitamin", dosage: "1 cap", frequency: "OD", duration: "30 days" },
  { name: "Zinc", dosage: "20mg", frequency: "OD", duration: "14 days" },
];

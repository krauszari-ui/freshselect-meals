/**
 * One-record end-to-end smoke test for the public intake API.
 * Uses unmistakably fake data, suppresses emails, and creates only a tiny PNG.
 */
const baseUrl = "http://127.0.0.1:3000";
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const suffix = Date.now().toString().slice(-6);
const medicaidId = `ZZ${String(Date.now() % 100000).padStart(5, "0")}A`;

async function trpc(path, input) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "127.0.0.1" },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const body = await response.json();
  const error = body?.[0]?.error?.json?.message ?? body?.[0]?.error?.message;
  if (!response.ok || error) throw new Error(`${path} failed: ${error ?? JSON.stringify(body)}`);
  return body?.[0]?.result?.data?.json;
}

const uploaded = await trpc("upload.document", {
  fileName: "qa-audit-tiny.png",
  fileData: tinyPng,
  contentType: "image/png",
  category: "qa_audit",
});

const submission = await trpc("submission.submit", {
  neighborhood: "Williamsburg",
  supermarket: "Foodoo Kosher",
  firstName: "QA",
  lastName: `Audit ${suffix}`,
  dateOfBirth: "1990-01-01",
  medicaidId,
  cellPhone: "7185550000",
  homePhone: "",
  email: `qa-audit-${suffix}@example.invalid`,
  streetAddress: "123 QA Audit Street",
  aptUnit: "",
  city: "Brooklyn",
  state: "NY",
  zipcode: "11206",
  healthCategories: ["Diabetes"],
  dueDate: "",
  miscarriageDate: "",
  infantName: "",
  infantDateOfBirth: "",
  infantMedicaidId: "",
  employed: "No",
  spouseEmployed: "No",
  hasWic: "No",
  hasSnap: "No",
  foodAllergies: "No",
  foodAllergiesDetails: "",
  dietaryRestrictions: "",
  newApplicant: "Yes",
  transferAgencyName: "",
  additionalMembersCount: "0",
  householdMembers: [],
  mealFocus: [],
  breakfastItems: "",
  lunchItems: "",
  dinnerItems: "",
  snackItems: "",
  needsRefrigerator: "No",
  needsMicrowave: "No",
  needsCookingUtensils: "No",
  hipaaConsent: true,
  guardianName: "QA Audit Guardian",
  signatureDataUrl: `data:image/png;base64,${tinyPng}`,
  screeningQuestions: {
    livingSituation: "Stable",
    utilityShutoff: "No",
    receivesSnap: "No",
    receivesWic: "No",
    receivesTanf: "No",
    enrolledHealthHome: "No",
    householdMembersCount: "1",
    householdMembersWithMedicaid: "1",
    needsWorkAssistance: "No",
    wantsSchoolHelp: "No",
    transportationBarrier: "No",
    hasChronicIllness: "Yes",
    otherHealthIssues: "None",
    medicationsRequireRefrigeration: "No",
    pregnantOrPostpartum: "No",
    breastmilkRefrigeration: "No",
  },
  uploadedDocuments: { qaAuditTinyPng: uploaded.url },
  _skipEmail: true,
});

console.log(JSON.stringify({ medicaidId, upload: uploaded, submission }, null, 2));

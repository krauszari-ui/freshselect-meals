import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Leaf,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Store,
  Heart,
  UtensilsCrossed,
  Phone,
  Mail,
  AlertCircle,
  Baby,
  Calendar,
  Upload,
  FileText,
  X,
  Users,
  ClipboardList,
  Apple,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HouseholdMember {
  name: string;
  dateOfBirth: string;
  medicaidId: string;
}

interface ScreeningQuestions {
  livingSituation: string;
  utilityShutoff: string;
  receivesSnap: string;
  receivesWic: string;
  receivesTanf: string;
  enrolledHealthHome: string;
  householdMembersCount: string;
  householdMembersWithMedicaid: string;
  needsWorkAssistance: string;
  wantsSchoolHelp: string;
  transportationBarrier: string;
  hasChronicIllness: string;
  otherHealthIssues: string;
  medicationsRequireRefrigeration: string;
  pregnantOrPostpartum: string;
  breastmilkRefrigeration: string;
}

interface FormData {
  supermarket: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidId: string;
  cellPhone: string;
  homePhone: string;
  email: string;
  streetAddress: string;
  aptUnit: string;
  city: string;
  state: string;
  zipcode: string;
  healthCategories: string[];
  dueDate: string;
  miscarriageDate: string;
  infantName: string;
  infantDateOfBirth: string;
  infantMedicaidId: string;
  employed: string;
  spouseEmployed: string;
  hasWic: string;
  hasSnap: string;
  foodAllergies: string;
  foodAllergiesDetails: string;
  dietaryRestrictions: string;
  newApplicant: string;
  additionalMembersCount: string;
  householdMembers: HouseholdMember[];
  mealFocus: string[];
  breakfastItems: string;
  lunchItems: string;
  dinnerItems: string;
  snackItems: string;
  needsRefrigerator: string;
  needsMicrowave: string;
  needsCookingUtensils: string;
  hipaaConsent: boolean;
  screeningQuestions: ScreeningQuestions;
}

type FormErrors = Partial<Record<string, string>>;

interface UploadedDoc {
  url: string;
  fileName: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const INITIAL_SCREENING: ScreeningQuestions = {
  livingSituation: "",
  utilityShutoff: "",
  receivesSnap: "",
  receivesWic: "",
  receivesTanf: "",
  enrolledHealthHome: "",
  householdMembersCount: "",
  householdMembersWithMedicaid: "",
  needsWorkAssistance: "",
  wantsSchoolHelp: "",
  transportationBarrier: "",
  hasChronicIllness: "",
  otherHealthIssues: "",
  medicationsRequireRefrigeration: "",
  pregnantOrPostpartum: "",
  breastmilkRefrigeration: "",
};

const INITIAL_FORM: FormData = {
  supermarket: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  medicaidId: "",
  cellPhone: "",
  homePhone: "",
  email: "",
  streetAddress: "",
  aptUnit: "",
  city: "Brooklyn",
  state: "NY",
  zipcode: "",
  healthCategories: [],
  dueDate: "",
  miscarriageDate: "",
  infantName: "",
  infantDateOfBirth: "",
  infantMedicaidId: "",
  employed: "",
  spouseEmployed: "",
  hasWic: "",
  hasSnap: "",
  foodAllergies: "",
  foodAllergiesDetails: "",
  dietaryRestrictions: "",
  newApplicant: "",
  additionalMembersCount: "0",
  householdMembers: [],
  mealFocus: [],
  breakfastItems: "",
  lunchItems: "",
  dinnerItems: "",
  snackItems: "",
  needsRefrigerator: "",
  needsMicrowave: "",
  needsCookingUtensils: "",
  hipaaConsent: false,
  screeningQuestions: { ...INITIAL_SCREENING },
};

const SUPERMARKETS = [
  { name: "Foodoo", address: "4814 13th Ave, Brooklyn, NY 11219", icon: "🛒" },
  { name: "Rosemary Kosher", address: "4901 13th Ave, Brooklyn, NY 11219", icon: "🌿" },
  { name: "Chestnut", address: "1506 62nd St, Brooklyn, NY 11219", icon: "🌰" },
  { name: "Central Market", address: "4220 13th Ave, Brooklyn, NY 11219", icon: "🏪" },
  { name: "Bingo Wholesale", address: "4802 New Utrecht Ave, Brooklyn, NY 11219", icon: "🎪" },
];

const HEALTH_CATEGORIES = [
  "Pregnant",
  "Had a Miscarriage",
  "Postpartum (Within the last 12 months)",
  "Substance Use Disorder",
  "HIV / AIDS",
  "Diabetes",
  "Hypertension",
  "Serious Mental Illness (SMI)",
  "Chronic Condition",
];

const STEP_LABELS = [
  "Personal Info",
  "Screening & Health",
  "Meals & Preferences",
  "Grocery Selection",
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function validateStep1(form: FormData): FormErrors {
  const e: FormErrors = {};
  if (!form.firstName.trim()) e.firstName = "First name is required";
  if (!form.lastName.trim()) e.lastName = "Last name is required";
  if (!form.dateOfBirth) e.dateOfBirth = "Date of birth is required";
  if (!form.medicaidId.trim()) e.medicaidId = "Medicaid ID is required";
  else if (!/^[A-Za-z]{2}\d{5}[A-Za-z]$/.test(form.medicaidId))
    e.medicaidId = "Format: 2 letters, 5 digits, 1 letter (e.g. AB12345C)";
  if (!form.cellPhone.trim()) e.cellPhone = "Phone number is required";
  else if (!/^\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(form.cellPhone.trim()))
    e.cellPhone = "Enter a valid 10-digit phone number";
  if (!form.email.trim()) e.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    e.email = "Enter a valid email address";
  if (!form.streetAddress.trim()) e.streetAddress = "Street address is required";
  if (!form.city.trim()) e.city = "City is required";
  if (!form.state.trim()) e.state = "State is required";
  if (!form.zipcode.trim()) e.zipcode = "Zipcode is required";
  return e;
}

function validateStep2(form: FormData): FormErrors {
  const e: FormErrors = {};
  const sq = form.screeningQuestions;
  if (!sq.livingSituation) e["sq.livingSituation"] = "Required";
  if (!sq.utilityShutoff) e["sq.utilityShutoff"] = "Required";
  if (!sq.receivesSnap) e["sq.receivesSnap"] = "Required";
  if (!sq.receivesWic) e["sq.receivesWic"] = "Required";
  if (!sq.receivesTanf) e["sq.receivesTanf"] = "Required";
  if (!sq.enrolledHealthHome) e["sq.enrolledHealthHome"] = "Required";
  if (!sq.householdMembersCount) e["sq.householdMembersCount"] = "Required";
  if (!sq.householdMembersWithMedicaid) e["sq.householdMembersWithMedicaid"] = "Required";
  if (!sq.needsWorkAssistance) e["sq.needsWorkAssistance"] = "Required";
  if (!sq.wantsSchoolHelp) e["sq.wantsSchoolHelp"] = "Required";
  if (!sq.transportationBarrier) e["sq.transportationBarrier"] = "Required";
  if (!sq.hasChronicIllness) e["sq.hasChronicIllness"] = "Required";
  if (!sq.otherHealthIssues) e["sq.otherHealthIssues"] = "Required";
  if (!sq.medicationsRequireRefrigeration) e["sq.medicationsRequireRefrigeration"] = "Required";
  if (!sq.pregnantOrPostpartum) e["sq.pregnantOrPostpartum"] = "Required";
  if (!sq.breastmilkRefrigeration) e["sq.breastmilkRefrigeration"] = "Required";
  if (!form.employed) e.employed = "Required";
  if (!form.spouseEmployed) e.spouseEmployed = "Required";
  if (!form.newApplicant) e.newApplicant = "Required";
  // Household members required
  const memberCount = parseInt(form.additionalMembersCount) || 0;
  if (memberCount === 0) e.householdMembers = "At least one household member is required";
  // Conditional health fields
  if (form.healthCategories.includes("Pregnant") && !form.dueDate)
    e.dueDate = "Due date is required";
  if (form.healthCategories.includes("Had a Miscarriage") && !form.miscarriageDate)
    e.miscarriageDate = "Date of miscarriage is required";
  if (form.healthCategories.includes("Postpartum (Within the last 12 months)")) {
    if (!form.infantName.trim()) e.infantName = "Infant name is required";
    if (!form.infantDateOfBirth) e.infantDateOfBirth = "Infant DOB is required";
    if (!form.infantMedicaidId.trim()) e.infantMedicaidId = "Infant Medicaid ID is required";
  }
  return e;
}

function validateStep3(form: FormData): FormErrors {
  const e: FormErrors = {};
  if (form.mealFocus.length === 0) e.mealFocus = "Select at least one meal type";
  if (!form.needsRefrigerator) e.needsRefrigerator = "Required";
  if (!form.needsMicrowave) e.needsMicrowave = "Required";
  if (!form.needsCookingUtensils) e.needsCookingUtensils = "Required";
  if (!form.hipaaConsent) e.hipaaConsent = "You must agree to the HIPAA consent";
  return e;
}

function validateStep4(form: FormData): FormErrors {
  const e: FormErrors = {};
  if (!form.supermarket) e.supermarket = "Please select a supermarket";
  return e;
}

/* ─── Components ─────────────────────────────────────────────────────────── */

function YesNoSelect({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={error ? "border-red-400" : ""}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Yes">Yes</SelectItem>
          <SelectItem value="No">No</SelectItem>
        </SelectContent>
      </Select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function FileUploadField({
  label,
  category,
  uploads,
  setUploads,
  uploading,
  setUploading,
}: {
  label: string;
  category: string;
  uploads: Record<string, UploadedDoc>;
  setUploads: React.Dispatch<React.SetStateAction<Record<string, UploadedDoc>>>;
  uploading: Record<string, boolean>;
  setUploading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const uploadMutation = trpc.upload.document.useMutation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File must be under 10MB");
      return;
    }

    setUploading((prev) => ({ ...prev, [category]: true }));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      const result = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileData: base64,
        contentType: file.type,
        category,
      });

      setUploads((prev) => ({
        ...prev,
        [category]: { url: result.url, fileName: file.name },
      }));
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading((prev) => ({ ...prev, [category]: false }));
    }
  };

  const uploaded = uploads[category];
  const isUploading = uploading[category];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-stone-700">{label}</Label>
      {uploaded ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <FileText className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 truncate flex-1">{uploaded.fileName}</span>
          <button
            type="button"
            onClick={() => {
              setUploads((prev) => {
                const next = { ...prev };
                delete next[category];
                return next;
              });
            }}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-stone-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50/50 transition-colors"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-stone-400" />
              <span className="text-sm text-stone-500">Click to upload (max 10MB)</span>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

/* ─── Landing Page ───────────────────────────────────────────────────────── */

function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-green-800 font-serif">FreshSelect Meals</h1>
              <p className="text-xs text-stone-500">SCN Approved Vendor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:7183074664" className="flex items-center gap-1.5 text-stone-600 hover:text-green-700 text-sm">
              <Phone className="w-4 h-4" /> (718) 307-4664
            </a>
            <a href="mailto:info@freshselectmeals.com" className="flex items-center gap-1.5 text-stone-600 hover:text-green-700 text-sm">
              <Mail className="w-4 h-4" /> info@freshselectmeals.com
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-700 to-green-900" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-yellow-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-green-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white font-serif leading-tight mb-6">
            Free Nutritious Meals and Food Support for Our Community
          </h2>
          <p className="text-lg md:text-xl text-green-100 max-w-3xl mx-auto mb-8 leading-relaxed">
            If you are struggling to put healthy food on the table or have a medical condition that makes preparing meals difficult, we are here to help. Through the <strong className="text-white">New York Social Care Network (SCN)</strong> program, we provide free, home-delivered meals and grocery support to eligible Medicaid members.
          </p>
          <Button
            onClick={onStart}
            size="lg"
            className="bg-amber-500 hover:bg-amber-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold"
          >
            Start My Free Screening <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-green-200 text-sm mt-4">
            100% voluntary. Will not affect your Medicaid eligibility.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h3 className="text-2xl md:text-3xl font-bold text-green-800 font-serif text-center mb-12">How the Program Works</h3>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: "1", title: "Screening", desc: "Take a quick survey to identify your food needs.", icon: ClipboardList },
            { step: "2", title: "Eligibility Check", desc: "We verify your Medicaid status and clinical needs.", icon: ShieldCheck },
            { step: "3", title: "Nutrition Plan", desc: "We refer you to the food program that fits your life.", icon: Apple },
            { step: "4", title: "Delivery", desc: "Begin receiving meals or grocery vouchers at no cost.", icon: Store },
          ].map((item) => (
            <Card key={item.step} className="border-stone-200 hover:border-green-300 hover:shadow-md transition-all">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-green-700" />
                </div>
                <div className="text-xs font-bold text-amber-600 mb-1">STEP {item.step}</div>
                <h4 className="font-bold text-stone-800 mb-2">{item.title}</h4>
                <p className="text-sm text-stone-600">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Eligibility */}
      <section className="bg-stone-50 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h3 className="text-2xl md:text-3xl font-bold text-green-800 font-serif text-center mb-8">Who is Eligible?</h3>
          <p className="text-center text-stone-600 mb-10 max-w-3xl mx-auto">
            To receive Enhanced Nutrition Services, you must meet the following criteria:
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "Medicaid Status", desc: "Enrolled in Medicaid Managed Care (mainstream plans, HIV-SNPs, or HARP)." },
              { title: "Identified Need", desc: "Screen positive for an unmet need regarding food security." },
              { title: "Priority Group", desc: "Pregnant/Postpartum, High-Risk Children, Chronic Conditions, SUD, SMI, or High Utilizers." },
              { title: "Clinical Necessity", desc: "For certain programs, a medical provider confirms services are medically appropriate." },
            ].map((item) => (
              <Card key={item.title} className="border-stone-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-stone-800 mb-1">{item.title}</h4>
                      <p className="text-sm text-stone-600">{item.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h3 className="text-2xl md:text-3xl font-bold text-green-800 font-serif text-center mb-12">Our Nutrition Programs</h3>
        <div className="space-y-4">
          {[
            { title: "Medically Tailored Meals (MTM)", desc: "Meals designed by a Registered Dietitian for your specific medical needs, delivered to your home." },
            { title: "Clinically Appropriate Home-Delivered Meals", desc: "For those who cannot prepare meals but do not require specific medical tailoring." },
            { title: "Food Prescriptions", desc: "Weekly food boxes or vouchers for produce, meat, and grains at local markets." },
            { title: "Pantry Stocking", desc: "Fresh produce and healthy groceries delivered to your home (pregnant/postpartum and high-risk children)." },
            { title: "Cooking Supplies", desc: "Essential kitchenware (pots, pans, utensils) or even a refrigerator if needed." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4 p-4 rounded-lg hover:bg-stone-50 transition-colors">
              <Heart className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-stone-800">{item.title}</h4>
                <p className="text-sm text-stone-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-800 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-white font-serif mb-4">Get Started Today</h3>
          <p className="text-green-100 mb-8">Ready to see if you qualify? Take our secure Self-Screening Survey.</p>
          <Button
            onClick={onStart}
            size="lg"
            className="bg-amber-500 hover:bg-amber-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg"
          >
            Start My Free Screening <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-green-200 text-sm mt-4">
            Your information is protected by strict privacy and security laws.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h3 className="text-xl font-bold text-green-800 font-serif text-center mb-6">Contact Us</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-stone-600">
          <a href="tel:7183074664" className="flex items-center gap-2 hover:text-green-700">
            <Phone className="w-5 h-5" /> (718) 307-4664
          </a>
          <a href="mailto:info@freshselectmeals.com" className="flex items-center gap-2 hover:text-green-700">
            <Mail className="w-5 h-5" /> info@freshselectmeals.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stone-500">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600" />
            <span>FreshSelect Meals</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-green-700">Privacy Policy</a>
            <span>&copy; {new Date().getFullYear()} FreshSelect Meals</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Progress Bar ───────────────────────────────────────────────────────── */

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between mb-3">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i + 1 < step
                  ? "bg-green-600 text-white"
                  : i + 1 === step
                  ? "bg-amber-500 text-white ring-4 ring-amber-200"
                  : "bg-stone-200 text-stone-500"
              }`}
            >
              {i + 1 < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block ${i + 1 === step ? "text-amber-600 font-semibold" : "text-stone-500"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-green-500 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");
  const [uploads, setUploads] = useState<Record<string, UploadedDoc>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const [ref] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ref") || "";
  });

  const submitMutation = trpc.submission.submit.useMutation({
    onSuccess: (data) => {
      setRefNumber(data.referenceNumber);
      setSubmitted(true);
    },
  });

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateScreening = (key: keyof ScreeningQuestions, value: string) => {
    setForm((prev) => ({
      ...prev,
      screeningQuestions: { ...prev.screeningQuestions, [key]: value },
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`sq.${key}`];
      return next;
    });
  };

  useEffect(() => {
    const count = parseInt(form.additionalMembersCount) || 0;
    setForm((prev) => {
      const current = [...prev.householdMembers];
      while (current.length < count) current.push({ name: "", dateOfBirth: "", medicaidId: "" });
      return { ...prev, householdMembers: current.slice(0, count) };
    });
  }, [form.additionalMembersCount]);

  const scrollToTop = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goNext = () => {
    let errs: FormErrors = {};
    if (step === 1) errs = validateStep1(form);
    else if (step === 2) errs = validateStep2(form);
    else if (step === 3) errs = validateStep3(form);
    else if (step === 4) errs = validateStep4(form);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      scrollToTop();
      return;
    }

    if (step === 4) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
      scrollToTop();
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      scrollToTop();
    }
  };

  const handleSubmit = () => {
    const uploadedDocuments: Record<string, string> = {};
    for (const [key, doc] of Object.entries(uploads)) {
      uploadedDocuments[key] = doc.url;
    }

    submitMutation.mutate({
      ...form,
      ref: ref || undefined,
      uploadedDocuments: Object.keys(uploadedDocuments).length > 0 ? uploadedDocuments : undefined,
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!showForm) {
    return <LandingPage onStart={() => setShowForm(true)} />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-green-800 font-serif mb-4">Application Submitted!</h2>
          <Card className="border-green-200 bg-green-50 mb-6">
            <CardContent className="p-6">
              <p className="text-sm text-stone-600 mb-2">Your Reference Number</p>
              <p className="text-3xl font-bold text-green-800 tracking-widest">{refNumber}</p>
            </CardContent>
          </Card>
          <div className="space-y-3 text-left bg-white rounded-xl border border-stone-200 p-6 mb-6">
            <h3 className="font-bold text-stone-800">What Happens Next?</h3>
            <div className="space-y-2 text-sm text-stone-600">
              <p>1. A confirmation email has been sent to your email address.</p>
              <p>2. Our Social Care Navigator will review your application within 5 business days.</p>
              <p>3. We will contact you to schedule a follow-up conversation.</p>
              <p>4. Once approved, you will begin receiving your food benefits.</p>
            </div>
          </div>
          <div className="text-sm text-stone-500 mb-6">
            <p>Questions? Call us at <a href="tel:7183074664" className="text-green-700 underline">(718) 307-4664</a> or email <a href="mailto:info@freshselectmeals.com" className="text-green-700 underline">info@freshselectmeals.com</a></p>
          </div>
          <Button
            onClick={() => {
              setShowForm(false);
              setSubmitted(false);
              setStep(1);
              setForm({ ...INITIAL_FORM });
              setUploads({});
              setErrors({});
            }}
            variant="outline"
            className="border-green-600 text-green-700"
          >
            Return to Home
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Form Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-green-800 font-serif">FreshSelect Meals</span>
          </div>
          <button
            onClick={() => setShowForm(false)}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Back to Home
          </button>
        </div>
      </header>

      <div ref={formRef} className="max-w-3xl mx-auto px-4 py-8">
        <ProgressBar step={step} totalSteps={4} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* ─── STEP 1: Personal Info ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-green-700" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-800 font-serif">Mother's Personal Information</h2>
                  <p className="text-stone-500 text-sm mt-1">Please provide your personal details and contact information.</p>
                </div>

                {Object.keys(errors).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Please fix the following errors:</p>
                      <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                        {Object.values(errors).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Personal Info */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-stone-700">First Name *</Label>
                        <Input
                          value={form.firstName}
                          onChange={(e) => update("firstName", e.target.value)}
                          className={errors.firstName ? "border-red-400" : ""}
                          placeholder="First Name"
                        />
                        {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                      </div>
                      <div>
                        <Label className="text-stone-700">Last Name *</Label>
                        <Input
                          value={form.lastName}
                          onChange={(e) => update("lastName", e.target.value)}
                          className={errors.lastName ? "border-red-400" : ""}
                          placeholder="Last Name"
                        />
                        {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-stone-700">Date of Birth *</Label>
                        <Input
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => update("dateOfBirth", e.target.value)}
                          className={errors.dateOfBirth ? "border-red-400" : ""}
                        />
                        {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
                      </div>
                      <div>
                        <Label className="text-stone-700">Medicaid ID (CIN) *</Label>
                        <Input
                          value={form.medicaidId}
                          onChange={(e) => update("medicaidId", e.target.value.toUpperCase())}
                          className={errors.medicaidId ? "border-red-400" : ""}
                          placeholder="AB12345C"
                          maxLength={8}
                        />
                        {errors.medicaidId && <p className="text-red-500 text-xs mt-1">{errors.medicaidId}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-600" /> Contact Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-stone-700">Cell Phone *</Label>
                        <Input
                          value={form.cellPhone}
                          onChange={(e) => update("cellPhone", e.target.value)}
                          className={errors.cellPhone ? "border-red-400" : ""}
                          placeholder="(718) 555-0123"
                        />
                        {errors.cellPhone && <p className="text-red-500 text-xs mt-1">{errors.cellPhone}</p>}
                      </div>
                      <div>
                        <Label className="text-stone-700">Home Phone</Label>
                        <Input
                          value={form.homePhone}
                          onChange={(e) => update("homePhone", e.target.value)}
                          placeholder="(718) 555-0456"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-stone-700">Email Address *</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        className={errors.email ? "border-red-400" : ""}
                        placeholder="your@email.com"
                      />
                      {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                  </CardContent>
                </Card>

                {/* Address */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600" /> Address
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <Label className="text-stone-700">Street Address *</Label>
                        <Input
                          value={form.streetAddress}
                          onChange={(e) => update("streetAddress", e.target.value)}
                          className={errors.streetAddress ? "border-red-400" : ""}
                          placeholder="123 Main Street"
                        />
                        {errors.streetAddress && <p className="text-red-500 text-xs mt-1">{errors.streetAddress}</p>}
                      </div>
                      <div>
                        <Label className="text-stone-700">Apt/Unit</Label>
                        <Input
                          value={form.aptUnit}
                          onChange={(e) => update("aptUnit", e.target.value)}
                          placeholder="Apt 2B"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-stone-700">City *</Label>
                        <Input
                          value={form.city}
                          onChange={(e) => update("city", e.target.value)}
                          className={errors.city ? "border-red-400" : ""}
                        />
                      </div>
                      <div>
                        <Label className="text-stone-700">State *</Label>
                        <Input
                          value={form.state}
                          onChange={(e) => update("state", e.target.value)}
                          className={errors.state ? "border-red-400" : ""}
                        />
                      </div>
                      <div>
                        <Label className="text-stone-700">Zipcode *</Label>
                        <Input
                          value={form.zipcode}
                          onChange={(e) => update("zipcode", e.target.value)}
                          className={errors.zipcode ? "border-red-400" : ""}
                          placeholder="11219"
                        />
                        {errors.zipcode && <p className="text-red-500 text-xs mt-1">{errors.zipcode}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Document Uploads */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-green-600" /> Required Documents
                    </h3>
                    <p className="text-sm text-stone-500">Please upload photos or scans of the following documents.</p>

                    <FileUploadField
                      label="Mother's Medicaid Card *"
                      category="motherMedicaidCard"
                      uploads={uploads}
                      setUploads={setUploads}
                      uploading={uploading}
                      setUploading={setUploading}
                    />

                    <FileUploadField
                      label="Marriage License"
                      category="marriageLicense"
                      uploads={uploads}
                      setUploads={setUploads}
                      uploading={uploading}
                      setUploading={setUploading}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── STEP 2: Screening & Health ────────────────────────── */}
            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ClipboardList className="w-7 h-7 text-green-700" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-800 font-serif">SCN Screening & Health</h2>
                  <p className="text-stone-500 text-sm mt-1">Answer the screening questions and provide health information.</p>
                </div>

                {Object.keys(errors).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">Please answer all required questions before continuing.</p>
                  </div>
                )}

                {/* SCN Screening Questions */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-5">
                    <h3 className="font-bold text-stone-800 text-lg">SCN Screening Questionnaire</h3>

                    {/* Q1 - Living Situation */}
                    <div>
                      <Label className="text-stone-700">1. Current living situation *</Label>
                      <Select
                        value={form.screeningQuestions.livingSituation}
                        onValueChange={(v) => updateScreening("livingSituation", v)}
                      >
                        <SelectTrigger className={errors["sq.livingSituation"] ? "border-red-400" : ""}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {["Renting", "Own Home", "Shelter", "Homeless", "Living with Family/Friends", "Other"].map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors["sq.livingSituation"] && <p className="text-red-500 text-xs mt-1">{errors["sq.livingSituation"]}</p>}
                    </div>

                    {/* Q2-Q6 Yes/No */}
                    {[
                      { key: "utilityShutoff" as const, label: "2. Utility shutoff threat (past 12 months) *" },
                      { key: "receivesSnap" as const, label: "3. Receives SNAP (Food Stamps) *" },
                      { key: "receivesWic" as const, label: "4. Receives WIC *" },
                      { key: "receivesTanf" as const, label: "5. Receives TANF *" },
                      { key: "enrolledHealthHome" as const, label: "6. Enrolled in Health Home *" },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <Label className="text-stone-700">{label}</Label>
                        <YesNoSelect
                          value={form.screeningQuestions[key]}
                          onChange={(v) => updateScreening(key, v)}
                          error={errors[`sq.${key}`]}
                        />
                      </div>
                    ))}

                    {/* Q7-Q8 Number inputs */}
                    <div>
                      <Label className="text-stone-700">7. Household members *</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={form.screeningQuestions.householdMembersCount}
                        onChange={(e) => updateScreening("householdMembersCount", e.target.value)}
                        className={errors["sq.householdMembersCount"] ? "border-red-400" : ""}
                        placeholder="Enter number"
                      />
                      {errors["sq.householdMembersCount"] && <p className="text-red-500 text-xs mt-1">{errors["sq.householdMembersCount"]}</p>}
                    </div>
                    <div>
                      <Label className="text-stone-700">8. Household members with Medicaid *</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={form.screeningQuestions.householdMembersWithMedicaid}
                        onChange={(e) => updateScreening("householdMembersWithMedicaid", e.target.value)}
                        className={errors["sq.householdMembersWithMedicaid"] ? "border-red-400" : ""}
                        placeholder="Enter number"
                      />
                      {errors["sq.householdMembersWithMedicaid"] && <p className="text-red-500 text-xs mt-1">{errors["sq.householdMembersWithMedicaid"]}</p>}
                    </div>

                    {/* Q9-Q16 Yes/No */}
                    {[
                      { key: "needsWorkAssistance" as const, label: "9. Needs work assistance *" },
                      { key: "wantsSchoolHelp" as const, label: "10. Wants school or training help *" },
                      { key: "transportationBarrier" as const, label: "11. Transportation barrier (past 12 months) *" },
                      { key: "hasChronicIllness" as const, label: "12. Has chronic illness *" },
                      { key: "otherHealthIssues" as const, label: "13. Other known health issues *" },
                      { key: "medicationsRequireRefrigeration" as const, label: "14. Medications require refrigeration *" },
                      { key: "pregnantOrPostpartum" as const, label: "15. Pregnant or postpartum *" },
                      { key: "breastmilkRefrigeration" as const, label: "16. Breastmilk refrigeration needed *" },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <Label className="text-stone-700">{label}</Label>
                        <YesNoSelect
                          value={form.screeningQuestions[key]}
                          onChange={(v) => updateScreening(key, v)}
                          error={errors[`sq.${key}`]}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Health Categories */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-green-600" /> Health Categories
                    </h3>
                    <p className="text-sm text-stone-500">Select all that apply to you.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {HEALTH_CATEGORIES.map((cat) => (
                        <label
                          key={cat}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            form.healthCategories.includes(cat)
                              ? "border-green-400 bg-green-50"
                              : "border-stone-200 hover:border-green-300"
                          }`}
                        >
                          <Checkbox
                            checked={form.healthCategories.includes(cat)}
                            onCheckedChange={(checked) => {
                              update(
                                "healthCategories",
                                checked
                                  ? [...form.healthCategories, cat]
                                  : form.healthCategories.filter((c) => c !== cat)
                              );
                            }}
                          />
                          <span className="text-sm text-stone-700">{cat}</span>
                        </label>
                      ))}
                    </div>

                    {/* Conditional: Pregnant -> Due Date */}
                    {form.healthCategories.includes("Pregnant") && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                        <Label className="text-stone-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-600" /> Due Date *
                        </Label>
                        <Input
                          type="date"
                          value={form.dueDate}
                          onChange={(e) => update("dueDate", e.target.value)}
                          className={errors.dueDate ? "border-red-400 mt-2" : "mt-2"}
                        />
                        {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
                      </div>
                    )}

                    {/* Conditional: Miscarriage -> Date */}
                    {form.healthCategories.includes("Had a Miscarriage") && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                        <Label className="text-stone-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-600" /> Date of Miscarriage *
                        </Label>
                        <Input
                          type="date"
                          value={form.miscarriageDate}
                          onChange={(e) => update("miscarriageDate", e.target.value)}
                          className={errors.miscarriageDate ? "border-red-400 mt-2" : "mt-2"}
                        />
                        {errors.miscarriageDate && <p className="text-red-500 text-xs mt-1">{errors.miscarriageDate}</p>}
                      </div>
                    )}

                    {/* Conditional: Postpartum -> Infant Info */}
                    {form.healthCategories.includes("Postpartum (Within the last 12 months)") && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3 space-y-3">
                        <h4 className="font-semibold text-stone-700 flex items-center gap-2">
                          <Baby className="w-4 h-4 text-blue-600" /> Infant Information
                        </h4>
                        <div>
                          <Label className="text-stone-700">Infant Name *</Label>
                          <Input
                            value={form.infantName}
                            onChange={(e) => update("infantName", e.target.value)}
                            className={errors.infantName ? "border-red-400" : ""}
                            placeholder="Baby's full name"
                          />
                          {errors.infantName && <p className="text-red-500 text-xs mt-1">{errors.infantName}</p>}
                        </div>
                        <div>
                          <Label className="text-stone-700">Infant Date of Birth *</Label>
                          <Input
                            type="date"
                            value={form.infantDateOfBirth}
                            onChange={(e) => update("infantDateOfBirth", e.target.value)}
                            className={errors.infantDateOfBirth ? "border-red-400" : ""}
                          />
                          {errors.infantDateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.infantDateOfBirth}</p>}
                        </div>
                        <div>
                          <Label className="text-stone-700">Infant Medicaid ID (CIN) *</Label>
                          <Input
                            value={form.infantMedicaidId}
                            onChange={(e) => update("infantMedicaidId", e.target.value.toUpperCase())}
                            className={errors.infantMedicaidId ? "border-red-400" : ""}
                            placeholder="AB12345C"
                            maxLength={8}
                          />
                          {errors.infantMedicaidId && <p className="text-red-500 text-xs mt-1">{errors.infantMedicaidId}</p>}
                        </div>

                        {/* Child document uploads */}
                        <FileUploadField
                          label="Child's Medicaid Card *"
                          category="childMedicaidCard_0"
                          uploads={uploads}
                          setUploads={setUploads}
                          uploading={uploading}
                          setUploading={setUploading}
                        />
                        <FileUploadField
                          label="Child's Birth Certificate *"
                          category="childBirthCertificate_0"
                          uploads={uploads}
                          setUploads={setUploads}
                          uploading={uploading}
                          setUploading={setUploading}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Benefits & Employment */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800">Benefits & Employment</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { key: "employed" as const, label: "Employed *" },
                        { key: "spouseEmployed" as const, label: "Spouse Employed *" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-stone-700">{label}</Label>
                          <YesNoSelect
                            value={form[key]}
                            onChange={(v) => update(key, v)}
                            error={errors[key]}
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label className="text-stone-700">New application or transfer from different agency *</Label>
                      <Select value={form.newApplicant} onValueChange={(v) => update("newApplicant", v)}>
                        <SelectTrigger className={errors.newApplicant ? "border-red-400" : ""}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New Application</SelectItem>
                          <SelectItem value="Transfer">Transfer from Different Agency</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.newApplicant && <p className="text-red-500 text-xs mt-1">{errors.newApplicant}</p>}
                    </div>
                  </CardContent>
                </Card>

                {/* Food Allergies / Dietary Restrictions */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800">Food Allergies / Dietary Restrictions</h3>
                    <div>
                      <Label className="text-stone-700">Food Allergies</Label>
                      <Select value={form.foodAllergies} onValueChange={(v) => update("foodAllergies", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.foodAllergies === "Yes" && (
                      <div>
                        <Label className="text-stone-700">Please specify allergies</Label>
                        <Textarea
                          value={form.foodAllergiesDetails}
                          onChange={(e) => update("foodAllergiesDetails", e.target.value)}
                          placeholder="List your food allergies..."
                          rows={3}
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-stone-700">Dietary Restrictions</Label>
                      <Select value={form.dietaryRestrictions} onValueChange={(v) => update("dietaryRestrictions", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {["None", "Kosher", "Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Other"].map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Household Members */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" /> Household Members *
                    </h3>
                    <p className="text-sm text-stone-500">You must add at least one household member.</p>
                    {errors.householdMembers && <p className="text-red-500 text-xs">{errors.householdMembers}</p>}
                    <div>
                      <Label className="text-stone-700">Number of household members *</Label>
                      <Select
                        value={form.additionalMembersCount}
                        onValueChange={(v) => update("additionalMembersCount", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {i === 0 ? "None" : `${i} additional member${i > 1 ? "s" : ""}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {form.householdMembers.map((member, idx) => (
                      <div key={idx} className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-stone-700">Member {idx + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-stone-600 text-xs">Full Name</Label>
                            <Input
                              value={member.name}
                              onChange={(e) => {
                                const members = [...form.householdMembers];
                                members[idx] = { ...members[idx], name: e.target.value };
                                update("householdMembers", members);
                              }}
                              placeholder="Full Name"
                            />
                          </div>
                          <div>
                            <Label className="text-stone-600 text-xs">Date of Birth</Label>
                            <Input
                              type="date"
                              value={member.dateOfBirth}
                              onChange={(e) => {
                                const members = [...form.householdMembers];
                                members[idx] = { ...members[idx], dateOfBirth: e.target.value };
                                update("householdMembers", members);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-stone-600 text-xs">Medicaid ID</Label>
                            <Input
                              value={member.medicaidId}
                              onChange={(e) => {
                                const members = [...form.householdMembers];
                                members[idx] = { ...members[idx], medicaidId: e.target.value.toUpperCase() };
                                update("householdMembers", members);
                              }}
                              placeholder="AB12345C"
                              maxLength={8}
                            />
                          </div>
                        </div>

                        {/* Per-child document uploads */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                          <FileUploadField
                            label={`Member ${idx + 1} Medicaid Card`}
                            category={`memberMedicaidCard_${idx}`}
                            uploads={uploads}
                            setUploads={setUploads}
                            uploading={uploading}
                            setUploading={setUploading}
                          />
                          <FileUploadField
                            label={`Member ${idx + 1} Birth Certificate`}
                            category={`memberBirthCertificate_${idx}`}
                            uploads={uploads}
                            setUploads={setUploads}
                            uploading={uploading}
                            setUploading={setUploading}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── STEP 3: Meals & Preferences ───────────────────────── */}
            {step === 3 && (
              <div className="space-y-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UtensilsCrossed className="w-7 h-7 text-green-700" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-800 font-serif">Meal Preferences</h2>
                  <p className="text-stone-500 text-sm mt-1">Tell us about your meal needs and kitchen setup.</p>
                </div>

                {Object.keys(errors).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">Please complete all required fields.</p>
                  </div>
                )}

                {/* Meal Focus */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800">Meal Focus *</h3>
                    <p className="text-sm text-stone-500">Select the meals you need help with.</p>
                    {errors.mealFocus && <p className="text-red-500 text-xs">{errors.mealFocus}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      {["Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
                        <label
                          key={meal}
                          className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                            form.mealFocus.includes(meal)
                              ? "border-green-400 bg-green-50"
                              : "border-stone-200 hover:border-green-300"
                          }`}
                        >
                          <Checkbox
                            checked={form.mealFocus.includes(meal)}
                            onCheckedChange={(checked) => {
                              update(
                                "mealFocus",
                                checked
                                  ? [...form.mealFocus, meal]
                                  : form.mealFocus.filter((m) => m !== meal)
                              );
                            }}
                          />
                          <span className="text-sm font-medium text-stone-700">{meal}</span>
                        </label>
                      ))}
                    </div>

                    {form.mealFocus.includes("Breakfast") && (
                      <div>
                        <Label className="text-stone-700">Preferred Breakfast Items</Label>
                        <Textarea
                          value={form.breakfastItems}
                          onChange={(e) => update("breakfastItems", e.target.value)}
                          placeholder="e.g., eggs, oatmeal, fruit, cereal..."
                          rows={2}
                        />
                      </div>
                    )}
                    {form.mealFocus.includes("Lunch") && (
                      <div>
                        <Label className="text-stone-700">Preferred Lunch Items</Label>
                        <Textarea
                          value={form.lunchItems}
                          onChange={(e) => update("lunchItems", e.target.value)}
                          placeholder="e.g., sandwiches, salads, soup..."
                          rows={2}
                        />
                      </div>
                    )}
                    {form.mealFocus.includes("Dinner") && (
                      <div>
                        <Label className="text-stone-700">Preferred Dinner Items</Label>
                        <Textarea
                          value={form.dinnerItems}
                          onChange={(e) => update("dinnerItems", e.target.value)}
                          placeholder="e.g., chicken, rice, vegetables..."
                          rows={2}
                        />
                      </div>
                    )}
                    {form.mealFocus.includes("Snacks") && (
                      <div>
                        <Label className="text-stone-700">Preferred Snack Items</Label>
                        <Textarea
                          value={form.snackItems}
                          onChange={(e) => update("snackItems", e.target.value)}
                          placeholder="e.g., crackers, fruit, yogurt..."
                          rows={2}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Appliances */}
                <Card className="border-stone-200">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-stone-800">Household Appliances / Cooking Needs</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-stone-700">Needs Refrigerator *</Label>
                        <YesNoSelect
                          value={form.needsRefrigerator}
                          onChange={(v) => update("needsRefrigerator", v)}
                          error={errors.needsRefrigerator}
                        />
                      </div>
                      <div>
                        <Label className="text-stone-700">Needs Microwave *</Label>
                        <YesNoSelect
                          value={form.needsMicrowave}
                          onChange={(v) => update("needsMicrowave", v)}
                          error={errors.needsMicrowave}
                        />
                      </div>
                      <div>
                        <Label className="text-stone-700">Needs Cooking Utensils *</Label>
                        <YesNoSelect
                          value={form.needsCookingUtensils}
                          onChange={(v) => update("needsCookingUtensils", v)}
                          error={errors.needsCookingUtensils}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* HIPAA Consent */}
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-3">
                        <h3 className="font-bold text-stone-800">HIPAA Authorization & Privacy</h3>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <Checkbox
                            checked={form.hipaaConsent}
                            onCheckedChange={(checked) => update("hipaaConsent", checked === true)}
                            className="mt-0.5"
                          />
                          <span className="text-sm text-stone-700 leading-relaxed">
                            I authorize FreshSelect Meals to securely process my health and household information to coordinate my SCN food benefits, and I agree to the{" "}
                            <a href="/privacy" target="_blank" className="text-green-700 underline font-medium">
                              Privacy Policy
                            </a>
                            . *
                          </span>
                        </label>
                        {errors.hipaaConsent && (
                          <p className="text-red-500 text-sm">{errors.hipaaConsent}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── STEP 4: Grocery Selection ─────────────────────────── */}
            {step === 4 && (
              <div className="space-y-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Store className="w-7 h-7 text-green-700" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-800 font-serif">Choose Your Supermarket</h2>
                  <p className="text-stone-500 text-sm mt-1">Select your preferred grocery store for pickup or delivery.</p>
                </div>

                {errors.supermarket && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{errors.supermarket}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SUPERMARKETS.map((store) => (
                    <Card
                      key={store.name}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        form.supermarket === store.name
                          ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                          : "border-stone-200 hover:border-green-300"
                      }`}
                      onClick={() => update("supermarket", store.name)}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="text-4xl mb-3">{store.icon}</div>
                        <h3 className="font-bold text-stone-800 text-lg">{store.name}</h3>
                        <p className="text-sm text-stone-500 flex items-center justify-center gap-1 mt-2">
                          <MapPin className="w-3 h-3" /> {store.address}
                        </p>
                        {form.supermarket === store.name && (
                          <div className="mt-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Selected
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pb-8">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={step === 1}
            className="border-stone-300 text-stone-600"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          <span className="text-sm text-stone-500">
            Step {step} of 4
          </span>

          <Button
            onClick={goNext}
            disabled={submitMutation.isPending}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
              </>
            ) : step === 4 ? (
              <>
                Submit Application <CheckCircle2 className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next Step <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {submitMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              Something went wrong. Please try again. If the problem persists, call (718) 307-4664 or email info@freshselectmeals.com.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

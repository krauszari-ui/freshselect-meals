import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HouseholdMember {
  name: string;
  dateOfBirth: string;
  medicaidId: string;
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
}

type FormErrors = Partial<Record<string, string>>;

const SUPERMARKETS = [
  {
    name: "Foodoo",
    address: "249 Wallabout St.",
    color: "from-green-50 to-emerald-50",
    borderColor: "border-green-200",
    selectedBorder: "border-green-500 ring-2 ring-green-200",
  },
  {
    name: "Rosemary Kosher Supermarket",
    address: "392 Flushing Ave.",
    color: "from-amber-50 to-orange-50",
    borderColor: "border-amber-200",
    selectedBorder: "border-amber-500 ring-2 ring-amber-200",
  },
  {
    name: "Chestnut Supermarket",
    address: "700 Myrtle Ave.",
    color: "from-orange-50 to-red-50",
    borderColor: "border-orange-200",
    selectedBorder: "border-orange-500 ring-2 ring-orange-200",
  },
  {
    name: "Central Market",
    address: "50-54 Division Ave.",
    color: "from-blue-50 to-indigo-50",
    borderColor: "border-blue-200",
    selectedBorder: "border-blue-500 ring-2 ring-blue-200",
  },
];

const HEALTH_CATEGORIES = [
  "Enrolled in Health Home Care Management",
  "Pregnant",
  "Had a Miscarriage",
  "Postpartum (Within the last 12 months)",
  "Substance Use Disorder diagnosis",
  "Serious Mental Illness diagnosis",
  "Child under the age of 18 diagnosed with a chronic condition",
  "Any other health condition",
];

const MEAL_OPTIONS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

function validateStep1(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.supermarket) errors.supermarket = "Please select a supermarket";
  return errors;
}

function validateStep2(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.firstName.trim()) errors.firstName = "First name is required";
  if (!data.lastName.trim()) errors.lastName = "Last name is required";
  if (!data.dateOfBirth.trim())
    errors.dateOfBirth = "Date of birth is required";
  if (!data.medicaidId.trim()) {
    errors.medicaidId = "Medicaid ID is required";
  } else if (!/^[A-Za-z]{2}\d{5}[A-Za-z]$/.test(data.medicaidId)) {
    errors.medicaidId =
      "Must be 2 letters, 5 numbers, 1 letter (e.g. AB12345C)";
  }
  if (!data.cellPhone.trim()) {
    errors.cellPhone = "Cell phone is required";
  } else if (!/^[\d\s\-\(\)\+]{7,}$/.test(data.cellPhone)) {
    errors.cellPhone = "Please enter a valid phone number";
  }
  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Please enter a valid email address";
  }
  if (!data.streetAddress.trim())
    errors.streetAddress = "Street address is required";
  if (!data.city.trim()) errors.city = "City is required";
  if (!data.state.trim()) errors.state = "State is required";
  if (!data.zipcode.trim()) errors.zipcode = "Zipcode is required";

  // Conditional health field validations
  if (
    data.healthCategories.includes("Pregnant") &&
    !data.dueDate.trim()
  ) {
    errors.dueDate = "Due date is required when Pregnant is selected";
  }
  if (
    data.healthCategories.includes("Had a Miscarriage") &&
    !data.miscarriageDate.trim()
  ) {
    errors.miscarriageDate =
      "Date of miscarriage is required when Had a Miscarriage is selected";
  }
  if (
    data.healthCategories.includes("Postpartum (Within the last 12 months)")
  ) {
    if (!data.infantName.trim())
      errors.infantName = "Infant name is required when Postpartum is selected";
    if (!data.infantDateOfBirth.trim())
      errors.infantDateOfBirth =
        "Infant date of birth is required when Postpartum is selected";
    if (!data.infantMedicaidId.trim())
      errors.infantMedicaidId =
        "Infant Medicaid ID is required when Postpartum is selected";
  }

  if (!data.employed) errors.employed = "Please select";
  if (!data.spouseEmployed) errors.spouseEmployed = "Please select";
  if (!data.hasWic) errors.hasWic = "Please select";
  if (!data.hasSnap) errors.hasSnap = "Please select";
  if (!data.newApplicant) errors.newApplicant = "Please select";
  const count = parseInt(data.additionalMembersCount) || 0;
  for (let i = 0; i < count; i++) {
    const m = data.householdMembers[i];
    if (!m || !m.name.trim()) errors[`member_${i}_name`] = "Name is required";
    if (!m || !m.dateOfBirth.trim())
      errors[`member_${i}_dob`] = "DOB is required";
    if (!m || !m.medicaidId.trim())
      errors[`member_${i}_medicaidId`] = "Medicaid ID is required";
  }
  return errors;
}

function validateStep3(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.needsRefrigerator) errors.needsRefrigerator = "Please select";
  if (!data.needsMicrowave) errors.needsMicrowave = "Please select";
  if (!data.needsCookingUtensils) errors.needsCookingUtensils = "Please select";
  return errors;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-destructive text-sm mt-1 flex items-center gap-1">
      <AlertCircle className="w-3.5 h-3.5" />
      {error}
    </p>
  );
}

function ProgressBar({ step }: { step: number }) {
  const steps = [
    { num: 1, label: "Supermarket" },
    { num: 2, label: "Household" },
    { num: 3, label: "Meals" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8 px-4">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                step > s.num
                  ? "bg-primary text-primary-foreground"
                  : step === s.num
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
            </div>
            <span
              className={`text-xs mt-1.5 font-medium ${
                step >= s.num ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors duration-300 ${
                step > s.num ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

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
};

export default function Home() {
  const [step, setStep] = useState(0);
  const [refParam, setRefParam] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<FormData>({ ...INITIAL_FORM });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRefParam(ref);
  }, []);

  const submitMutation = trpc.submission.submit.useMutation({
    onSuccess: (data) => {
      setReferenceNumber(data.referenceNumber);
      setStep(4);
    },
  });

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const handleMembersCountChange = useCallback(
    (val: string) => {
      const count = parseInt(val) || 0;
      updateField("additionalMembersCount", val);
      setFormData((prev) => {
        const members = [...prev.householdMembers];
        while (members.length < count)
          members.push({ name: "", dateOfBirth: "", medicaidId: "" });
        return { ...prev, householdMembers: members.slice(0, count) };
      });
    },
    [updateField]
  );

  const updateMember = useCallback(
    (index: number, field: keyof HouseholdMember, value: string) => {
      setFormData((prev) => {
        const members = [...prev.householdMembers];
        members[index] = { ...members[index], [field]: value };
        return { ...prev, householdMembers: members };
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[
          `member_${index}_${field === "dateOfBirth" ? "dob" : field}`
        ];
        return next;
      });
    },
    []
  );

  const toggleHealthCategory = useCallback((category: string) => {
    setFormData((prev) => {
      const cats = prev.healthCategories.includes(category)
        ? prev.healthCategories.filter((c) => c !== category)
        : [...prev.healthCategories, category];
      // Clear conditional fields when unchecking
      const updates: Partial<FormData> = { healthCategories: cats };
      if (!cats.includes("Pregnant")) {
        updates.dueDate = "";
      }
      if (!cats.includes("Had a Miscarriage")) {
        updates.miscarriageDate = "";
      }
      if (!cats.includes("Postpartum (Within the last 12 months)")) {
        updates.infantName = "";
        updates.infantDateOfBirth = "";
        updates.infantMedicaidId = "";
      }
      return { ...prev, ...updates };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.dueDate;
      delete next.miscarriageDate;
      delete next.infantName;
      delete next.infantDateOfBirth;
      delete next.infantMedicaidId;
      return next;
    });
  }, []);

  const toggleMealFocus = useCallback((meal: string) => {
    setFormData((prev) => {
      const meals = prev.mealFocus.includes(meal)
        ? prev.mealFocus.filter((m) => m !== meal)
        : [...prev.mealFocus, meal];
      return { ...prev, mealFocus: meals };
    });
  }, []);

  const goNext = () => {
    let stepErrors: FormErrors = {};
    if (step === 1) stepErrors = validateStep1(formData);
    if (step === 2) stepErrors = validateStep2(formData);
    if (step === 3) stepErrors = validateStep3(formData);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    if (step === 3) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      ...formData,
      ref: refParam || undefined,
      homePhone: formData.homePhone || undefined,
      aptUnit: formData.aptUnit || undefined,
      foodAllergies: formData.foodAllergies || undefined,
      dueDate: formData.dueDate || undefined,
      miscarriageDate: formData.miscarriageDate || undefined,
      infantName: formData.infantName || undefined,
      infantDateOfBirth: formData.infantDateOfBirth || undefined,
      infantMedicaidId: formData.infantMedicaidId || undefined,
      breakfastItems: formData.breakfastItems || undefined,
      lunchItems: formData.lunchItems || undefined,
      dinnerItems: formData.dinnerItems || undefined,
      snackItems: formData.snackItems || undefined,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl text-foreground tracking-tight">
              FreshSelect Meals
            </span>
          </div>
          {step === 0 && (
            <Button
              onClick={() => setStep(1)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
            >
              Start Meal Selection
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {/* Hero */}
          {step === 0 && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-amber-50/30 to-orange-50/40" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/10 rounded-full translate-y-1/3 -translate-x-1/4" />
                <div className="relative container py-20 sm:py-28 lg:py-36">
                  <div className="max-w-3xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                      <ShieldCheck className="w-4 h-4" />
                      SCN Approved Vendor
                    </div>
                    <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-foreground leading-tight mb-6">
                      Choose Your Healthy
                      <br />
                      <span className="text-primary">Weekly Meals</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed">
                      As an SCN vendor, pick fresh meals from the best local
                      supermarkets in Williamsburg.{" "}
                      <span className="font-semibold text-foreground">
                        You choose &mdash; no fixed boxes.
                      </span>
                    </p>
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-10 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Confidential
                      </span>
                      <span className="text-border">&bull;</span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        SCN Approved
                      </span>
                      <span className="text-border">&bull;</span>
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-primary" />
                        Local & Fresh
                      </span>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => setStep(1)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all"
                    >
                      Start Meal Selection
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </section>

              <section className="container py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {[
                    {
                      icon: Store,
                      title: "Choose Your Store",
                      desc: "Pick from 4 trusted local kosher supermarkets in Williamsburg.",
                    },
                    {
                      icon: UtensilsCrossed,
                      title: "Select Your Meals",
                      desc: "Tell us exactly what your family wants for breakfast, lunch, dinner, and snacks.",
                    },
                    {
                      icon: Heart,
                      title: "We Handle the Rest",
                      desc: "We coordinate with your supermarket and confirm within 2 business days.",
                    },
                  ].map((f) => (
                    <Card
                      key={f.title}
                      className="border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-6 text-center">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <f.icon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="font-semibold text-foreground mb-2">
                          {f.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {f.desc}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {/* Wizard Steps */}
          {step >= 1 && step <= 3 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="container py-8 max-w-3xl mx-auto"
            >
              <ProgressBar step={step} />

              {/* Step 1 */}
              {step === 1 && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">
                      Choose Your Supermarket
                    </h2>
                    <p className="text-muted-foreground">
                      Select the local supermarket you'd like to order from
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SUPERMARKETS.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => updateField("supermarket", s.name)}
                        className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 bg-gradient-to-br ${
                          s.color
                        } ${
                          formData.supermarket === s.name
                            ? s.selectedBorder + " shadow-lg"
                            : s.borderColor + " hover:shadow-md"
                        }`}
                      >
                        {formData.supermarket === s.name && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center mb-3">
                          <Store className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-foreground text-base mb-1">
                          {s.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {s.address}
                        </p>
                      </button>
                    ))}
                  </div>
                  <FieldError error={errors.supermarket} />
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="space-y-8">
                  <div className="text-center mb-2">
                    <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">
                      Your Household & Needs
                    </h2>
                    <p className="text-muted-foreground">
                      Tell us about yourself and your household
                    </p>
                  </div>

                  {/* Personal Info */}
                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <Store className="w-4 h-4 text-primary" />
                        </div>
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">
                            First Name{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="firstName"
                            placeholder="Enter first name"
                            value={formData.firstName}
                            onChange={(e) =>
                              updateField("firstName", e.target.value)
                            }
                            className={
                              errors.firstName ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.firstName} />
                        </div>
                        <div>
                          <Label htmlFor="lastName">
                            Last Name{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="lastName"
                            placeholder="Enter last name"
                            value={formData.lastName}
                            onChange={(e) =>
                              updateField("lastName", e.target.value)
                            }
                            className={
                              errors.lastName ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.lastName} />
                        </div>
                        <div>
                          <Label htmlFor="dob">
                            Date of Birth{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="dob"
                            placeholder="MM/DD/YYYY"
                            value={formData.dateOfBirth}
                            onChange={(e) =>
                              updateField("dateOfBirth", e.target.value)
                            }
                            className={
                              errors.dateOfBirth ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.dateOfBirth} />
                        </div>
                        <div>
                          <Label htmlFor="medicaidId">
                            Medicaid ID{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="medicaidId"
                            placeholder="E.g. AB12345C"
                            value={formData.medicaidId}
                            onChange={(e) =>
                              updateField(
                                "medicaidId",
                                e.target.value.toUpperCase()
                              )
                            }
                            className={
                              errors.medicaidId ? "border-destructive" : ""
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            2 letters + 5 numbers + 1 letter (found on your
                            Medicaid/insurance card)
                          </p>
                          <FieldError error={errors.medicaidId} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Info */}
                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="cellPhone">
                            Cell Phone{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="cellPhone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={formData.cellPhone}
                            onChange={(e) =>
                              updateField("cellPhone", e.target.value)
                            }
                            className={
                              errors.cellPhone ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.cellPhone} />
                        </div>
                        <div>
                          <Label htmlFor="homePhone">Home Phone</Label>
                          <Input
                            id="homePhone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={formData.homePhone}
                            onChange={(e) =>
                              updateField("homePhone", e.target.value)
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="email">
                            Email Address{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="your@email.com"
                              value={formData.email}
                              onChange={(e) =>
                                updateField("email", e.target.value)
                              }
                              className={`pl-10 ${
                                errors.email ? "border-destructive" : ""
                              }`}
                            />
                          </div>
                          <FieldError error={errors.email} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Address */}
                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        Address
                      </h3>
                      <p className="text-sm text-muted-foreground -mt-2">
                        Your address must be in New York to be eligible.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label htmlFor="street">
                            Street Address{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="street"
                            placeholder="e.g., 123 Main St"
                            value={formData.streetAddress}
                            onChange={(e) =>
                              updateField("streetAddress", e.target.value)
                            }
                            className={
                              errors.streetAddress ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.streetAddress} />
                        </div>
                        <div>
                          <Label htmlFor="apt">Apt/Unit/Suite</Label>
                          <Input
                            id="apt"
                            placeholder="e.g., Apt 7A"
                            value={formData.aptUnit}
                            onChange={(e) =>
                              updateField("aptUnit", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="city">
                            City <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) =>
                              updateField("city", e.target.value)
                            }
                            className={errors.city ? "border-destructive" : ""}
                          />
                          <FieldError error={errors.city} />
                        </div>
                        <div>
                          <Label htmlFor="state">
                            State <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) =>
                              updateField("state", e.target.value)
                            }
                            className={
                              errors.state ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.state} />
                        </div>
                        <div>
                          <Label htmlFor="zip">
                            Zipcode <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="zip"
                            placeholder="e.g., 11206"
                            value={formData.zipcode}
                            onChange={(e) =>
                              updateField("zipcode", e.target.value)
                            }
                            className={
                              errors.zipcode ? "border-destructive" : ""
                            }
                          />
                          <FieldError error={errors.zipcode} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Health Categories */}
                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <Heart className="w-4 h-4 text-primary" />
                        </div>
                        Health Categories
                      </h3>
                      <p className="text-sm text-muted-foreground -mt-2">
                        Check off any category that applies to you or a family
                        member
                      </p>
                      <div className="space-y-3">
                        {HEALTH_CATEGORIES.map((cat) => (
                          <div key={cat}>
                            <label className="flex items-start gap-3 cursor-pointer group">
                              <Checkbox
                                checked={formData.healthCategories.includes(cat)}
                                onCheckedChange={() =>
                                  toggleHealthCategory(cat)
                                }
                                className="mt-0.5"
                              />
                              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                                {cat}
                              </span>
                            </label>

                            {/* Pregnant -> Due Date */}
                            {cat === "Pregnant" &&
                              formData.healthCategories.includes(
                                "Pregnant"
                              ) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="ml-8 mt-2 mb-1"
                                >
                                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                    <Label
                                      htmlFor="dueDate"
                                      className="text-sm flex items-center gap-1.5"
                                    >
                                      <Calendar className="w-3.5 h-3.5 text-primary" />
                                      Due Date{" "}
                                      <span className="text-destructive">
                                        *
                                      </span>
                                    </Label>
                                    <Input
                                      id="dueDate"
                                      type="date"
                                      value={formData.dueDate}
                                      onChange={(e) =>
                                        updateField("dueDate", e.target.value)
                                      }
                                      className={`mt-1 max-w-xs ${
                                        errors.dueDate
                                          ? "border-destructive"
                                          : ""
                                      }`}
                                    />
                                    <FieldError error={errors.dueDate} />
                                  </div>
                                </motion.div>
                              )}

                            {/* Had a Miscarriage -> Date of Miscarriage */}
                            {cat === "Had a Miscarriage" &&
                              formData.healthCategories.includes(
                                "Had a Miscarriage"
                              ) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="ml-8 mt-2 mb-1"
                                >
                                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                    <Label
                                      htmlFor="miscarriageDate"
                                      className="text-sm flex items-center gap-1.5"
                                    >
                                      <Calendar className="w-3.5 h-3.5 text-primary" />
                                      Date of Miscarriage{" "}
                                      <span className="text-destructive">
                                        *
                                      </span>
                                    </Label>
                                    <Input
                                      id="miscarriageDate"
                                      type="date"
                                      value={formData.miscarriageDate}
                                      onChange={(e) =>
                                        updateField(
                                          "miscarriageDate",
                                          e.target.value
                                        )
                                      }
                                      className={`mt-1 max-w-xs ${
                                        errors.miscarriageDate
                                          ? "border-destructive"
                                          : ""
                                      }`}
                                    />
                                    <FieldError
                                      error={errors.miscarriageDate}
                                    />
                                  </div>
                                </motion.div>
                              )}

                            {/* Postpartum -> Infant Name, DOB, Medicaid ID */}
                            {cat ===
                              "Postpartum (Within the last 12 months)" &&
                              formData.healthCategories.includes(
                                "Postpartum (Within the last 12 months)"
                              ) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="ml-8 mt-2 mb-1"
                                >
                                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
                                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                      <Baby className="w-4 h-4 text-primary" />
                                      Infant Information
                                    </p>
                                    <div>
                                      <Label
                                        htmlFor="infantName"
                                        className="text-sm"
                                      >
                                        Infant Name{" "}
                                        <span className="text-destructive">
                                          *
                                        </span>
                                      </Label>
                                      <Input
                                        id="infantName"
                                        placeholder="Enter infant's full name"
                                        value={formData.infantName}
                                        onChange={(e) =>
                                          updateField(
                                            "infantName",
                                            e.target.value
                                          )
                                        }
                                        className={`mt-1 ${
                                          errors.infantName
                                            ? "border-destructive"
                                            : ""
                                        }`}
                                      />
                                      <FieldError error={errors.infantName} />
                                    </div>
                                    <div>
                                      <Label
                                        htmlFor="infantDob"
                                        className="text-sm flex items-center gap-1.5"
                                      >
                                        <Calendar className="w-3.5 h-3.5 text-primary" />
                                        Infant Date of Birth{" "}
                                        <span className="text-destructive">
                                          *
                                        </span>
                                      </Label>
                                      <Input
                                        id="infantDob"
                                        type="date"
                                        value={formData.infantDateOfBirth}
                                        onChange={(e) =>
                                          updateField(
                                            "infantDateOfBirth",
                                            e.target.value
                                          )
                                        }
                                        className={`mt-1 max-w-xs ${
                                          errors.infantDateOfBirth
                                            ? "border-destructive"
                                            : ""
                                        }`}
                                      />
                                      <FieldError
                                        error={errors.infantDateOfBirth}
                                      />
                                    </div>
                                    <div>
                                      <Label
                                        htmlFor="infantMedicaidId"
                                        className="text-sm"
                                      >
                                        Infant Medicaid ID (CIN){" "}
                                        <span className="text-destructive">
                                          *
                                        </span>
                                      </Label>
                                      <Input
                                        id="infantMedicaidId"
                                        placeholder="Enter infant's Medicaid ID"
                                        value={formData.infantMedicaidId}
                                        onChange={(e) =>
                                          updateField(
                                            "infantMedicaidId",
                                            e.target.value
                                          )
                                        }
                                        className={`mt-1 ${
                                          errors.infantMedicaidId
                                            ? "border-destructive"
                                            : ""
                                        }`}
                                      />
                                      <FieldError
                                        error={errors.infantMedicaidId}
                                      />
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Benefits & Employment */}
                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground text-base">
                        Benefits & Employment
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(
                          [
                            {
                              id: "employed",
                              label: "Are you Employed?",
                              key: "employed",
                            },
                            {
                              id: "spouseEmployed",
                              label: "Is the Spouse Employed?",
                              key: "spouseEmployed",
                            },
                            {
                              id: "hasWic",
                              label: "Do you have WIC?",
                              key: "hasWic",
                            },
                            {
                              id: "hasSnap",
                              label: "Do you have SNAP?",
                              key: "hasSnap",
                            },
                          ] as const
                        ).map((q) => (
                          <div key={q.id}>
                            <Label>
                              {q.label}{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={formData[q.key]}
                              onValueChange={(val) => updateField(q.key, val)}
                            >
                              <SelectTrigger
                                className={
                                  errors[q.key] ? "border-destructive" : ""
                                }
                              >
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Yes">Yes</SelectItem>
                                <SelectItem value="No">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FieldError error={errors[q.key]} />
                          </div>
                        ))}
                        <div>
                          <Label>Food Allergies / Dietary Restrictions</Label>
                          <Input
                            placeholder="e.g., Nut allergy, Gluten-free"
                            value={formData.foodAllergies}
                            onChange={(e) =>
                              updateField("foodAllergies", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label>
                            New Applicant?{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.newApplicant}
                            onValueChange={(val) =>
                              updateField("newApplicant", val)
                            }
                          >
                            <SelectTrigger
                              className={
                                errors.newApplicant ? "border-destructive" : ""
                              }
                            >
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="Transfer">Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError error={errors.newApplicant} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Household Members */}
                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground text-base">
                        Additional Household Members
                      </h3>
                      <p className="text-sm text-muted-foreground -mt-2">
                        List spouse, children, and infants (do NOT enter the
                        applicant again). Only include those currently active on
                        Medicaid.
                      </p>
                      <div>
                        <Label>Number of Additional Members</Label>
                        <Select
                          value={formData.additionalMembersCount}
                          onValueChange={handleMembersCountChange}
                        >
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">None</SelectItem>
                            {Array.from({ length: 9 }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>
                                {i + 1} member{i > 0 ? "s" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <AnimatePresence>
                        {formData.householdMembers.map((member, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border border-border rounded-lg p-4 space-y-3 bg-muted/30"
                          >
                            <h4 className="text-sm font-semibold text-foreground">
                              Member {i + 1}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">
                                  Name{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  placeholder="Full name"
                                  value={member.name}
                                  onChange={(e) =>
                                    updateMember(i, "name", e.target.value)
                                  }
                                  className={
                                    errors[`member_${i}_name`]
                                      ? "border-destructive"
                                      : ""
                                  }
                                />
                                <FieldError
                                  error={errors[`member_${i}_name`]}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">
                                  Date of Birth{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  placeholder="MM/DD/YYYY"
                                  value={member.dateOfBirth}
                                  onChange={(e) =>
                                    updateMember(
                                      i,
                                      "dateOfBirth",
                                      e.target.value
                                    )
                                  }
                                  className={
                                    errors[`member_${i}_dob`]
                                      ? "border-destructive"
                                      : ""
                                  }
                                />
                                <FieldError
                                  error={errors[`member_${i}_dob`]}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">
                                  Medicaid ID{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  placeholder="AB12345C"
                                  value={member.medicaidId}
                                  onChange={(e) =>
                                    updateMember(
                                      i,
                                      "medicaidId",
                                      e.target.value.toUpperCase()
                                    )
                                  }
                                  className={
                                    errors[`member_${i}_medicaidId`]
                                      ? "border-destructive"
                                      : ""
                                  }
                                />
                                <FieldError
                                  error={errors[`member_${i}_medicaidId`]}
                                />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <div className="space-y-8">
                  <div className="text-center mb-2">
                    <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">
                      Meal Preferences
                    </h2>
                    <p className="text-muted-foreground">
                      Tell us what meals your family would like this week
                    </p>
                  </div>

                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <UtensilsCrossed className="w-4 h-4 text-primary" />
                        </div>
                        Meal Focus
                      </h3>
                      <p className="text-sm text-muted-foreground -mt-2">
                        Select which meals you'd like to focus on (select all
                        that apply)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {MEAL_OPTIONS.map((meal) => (
                          <button
                            key={meal.id}
                            type="button"
                            onClick={() => toggleMealFocus(meal.id)}
                            className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                              formData.mealFocus.includes(meal.id)
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-border hover:border-primary/30 hover:bg-muted/50"
                            }`}
                          >
                            <UtensilsCrossed className="w-6 h-6 mx-auto mb-1 text-primary/70" />
                            <span className="text-sm font-medium text-foreground">
                              {meal.label}
                            </span>
                            {formData.mealFocus.includes(meal.id) && (
                              <CheckCircle2 className="w-4 h-4 text-primary mx-auto mt-1" />
                            )}
                          </button>
                        ))}
                      </div>

                      <AnimatePresence>
                        {formData.mealFocus.includes("breakfast") && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2"
                          >
                            <Label htmlFor="breakfastItems">
                              What breakfast items would you like?
                            </Label>
                            <Textarea
                              id="breakfastItems"
                              placeholder="e.g., Eggs, cereal, yogurt, fresh fruit..."
                              value={formData.breakfastItems}
                              onChange={(e) =>
                                updateField("breakfastItems", e.target.value)
                              }
                              rows={2}
                            />
                          </motion.div>
                        )}
                        {formData.mealFocus.includes("lunch") && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2"
                          >
                            <Label htmlFor="lunchItems">
                              What lunch items would you like?
                            </Label>
                            <Textarea
                              id="lunchItems"
                              placeholder="e.g., Sandwiches, salads, soups..."
                              value={formData.lunchItems}
                              onChange={(e) =>
                                updateField("lunchItems", e.target.value)
                              }
                              rows={2}
                            />
                          </motion.div>
                        )}
                        {formData.mealFocus.includes("dinner") && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2"
                          >
                            <Label htmlFor="dinnerItems">
                              What dinner items would you like?
                            </Label>
                            <Textarea
                              id="dinnerItems"
                              placeholder="e.g., Chicken, rice, vegetables, pasta..."
                              value={formData.dinnerItems}
                              onChange={(e) =>
                                updateField("dinnerItems", e.target.value)
                              }
                              rows={2}
                            />
                          </motion.div>
                        )}
                        {formData.mealFocus.includes("snacks") && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2"
                          >
                            <Label htmlFor="snackItems">
                              What snack items would you like?
                            </Label>
                            <Textarea
                              id="snackItems"
                              placeholder="e.g., Granola bars, fruit, crackers..."
                              value={formData.snackItems}
                              onChange={(e) =>
                                updateField("snackItems", e.target.value)
                              }
                              rows={2}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="font-semibold text-foreground text-base">
                        Household Appliances / Cooking Needs
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label>
                            Needs Refrigerator?{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.needsRefrigerator}
                            onValueChange={(val) =>
                              updateField("needsRefrigerator", val)
                            }
                          >
                            <SelectTrigger
                              className={
                                errors.needsRefrigerator
                                  ? "border-destructive"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError error={errors.needsRefrigerator} />
                        </div>
                        <div>
                          <Label>
                            Needs Microwave?{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.needsMicrowave}
                            onValueChange={(val) =>
                              updateField("needsMicrowave", val)
                            }
                          >
                            <SelectTrigger
                              className={
                                errors.needsMicrowave
                                  ? "border-destructive"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError error={errors.needsMicrowave} />
                        </div>
                        <div>
                          <Label>
                            Needs Cooking Utensils?{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.needsCookingUtensils}
                            onValueChange={(val) =>
                              updateField("needsCookingUtensils", val)
                            }
                          >
                            <SelectTrigger
                              className={
                                errors.needsCookingUtensils
                                  ? "border-destructive"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError error={errors.needsCookingUtensils} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pb-8">
                <Button
                  variant="outline"
                  onClick={goBack}
                  disabled={submitMutation.isPending}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {step === 1 ? "Back to Home" : "Previous"}
                </Button>
                <Button
                  onClick={goNext}
                  disabled={submitMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1 min-w-[140px]"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : step === 3 ? (
                    <>
                      Submit Application
                      <CheckCircle2 className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Next Step
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              {submitMutation.isError && (
                <div className="mb-8 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Submission Error</p>
                    <p>
                      {submitMutation.error?.message ||
                        "Something went wrong. Please try again."}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Success */}
          {step === 4 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="container py-16 max-w-2xl mx-auto text-center"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
                Thank You!
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Your weekly meal selection has been received. We will confirm
                with your supermarket and contact you within{" "}
                <span className="font-semibold text-foreground">
                  2 business days
                </span>
                .
              </p>
              <div className="inline-block bg-muted rounded-xl px-8 py-4 mb-8">
                <p className="text-sm text-muted-foreground mb-1">
                  Your Reference Number
                </p>
                <p className="text-2xl font-mono font-bold text-primary tracking-widest">
                  {referenceNumber}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-8">
                Please save this reference number for your records.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(0);
                  setFormData({ ...INITIAL_FORM });
                }}
                className="font-medium"
              >
                Start a New Selection
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} FreshSelect Meals &mdash; An SCN
            Approved Vendor serving Williamsburg families.
          </p>
          <p className="mt-1 text-xs">
            Confidential &bull; SCN Approved &bull; Local & Fresh
          </p>
        </div>
      </footer>
    </div>
  );
}

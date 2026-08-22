import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PatientAiService {
  private readonly logger = new Logger(PatientAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Explain a lab result in plain language for the patient
   */
  async explainLabResult(data: {
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
    patientAge?: number;
    patientGender?: string;
  }): Promise<{
    explanation: string;
    whatItMeans: string;
    isAbnormal: boolean;
    severity: 'normal' | 'low' | 'high' | 'critical';
    recommendations: string[];
    followUp: string;
  }> {
    const prompt = `You are a patient-friendly health educator. Explain the following lab test result in plain, easy-to-understand language.

Test: ${data.testName}
Result: ${data.value} ${data.unit || ''}
Reference Range: ${data.referenceRange || 'Not available'}
Flag: ${data.flag || 'normal'}
Patient: ${data.patientAge || 'adult'} years old, ${data.patientGender || 'unknown gender'}

Provide:
1. A simple explanation of what this test measures
2. What the result means in plain language
3. Whether the result is normal, low, high, or critical
4. Practical recommendations for the patient
5. When to follow up with their doctor

Respond as JSON:
{
  "explanation": "what the test measures (simple terms)",
  "whatItMeans": "what this specific result means",
  "isAbnormal": boolean,
  "severity": "normal" | "low" | "high" | "critical",
  "recommendations": ["actionable advice items"],
  "followUp": "when to see the doctor"
}

IMPORTANT: This is educational information only, not medical advice. Always recommend consulting their healthcare provider.`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.3,
        model: 'mistral',
      });
    } catch (err) {
      this.logger.error('Lab result explanation failed', err);
      throw err;
    }
  }

  /**
   * AI symptom checker / care navigator
   * Patients describe symptoms in free-text, AI recommends care pathway
   */
  async assessSymptoms(data: {
    symptoms: string;
    duration?: string;
    severity?: string;
    patientAge?: number;
    patientGender?: string;
    knownConditions?: string[];
    currentMedications?: string[];
  }): Promise<{
    urgencyLevel: 'self_care' | 'schedule_appointment' | 'urgent_care' | 'emergency';
    urgencyReason: string;
    possibleCauses: string[];
    selfCareAdvice: string[];
    recommendedAction: string;
    questionsToAskDoctor: string[];
    redFlagSymptoms: string[];
    disclaimer: string;
  }> {
    const prompt = `You are a clinical triage assistant helping a patient understand their symptoms and navigate to appropriate care.

Patient symptoms: "${data.symptoms}"
Duration: ${data.duration || 'not specified'}
Severity: ${data.severity || 'not specified'}
Patient age: ${data.patientAge || 'unknown'}
Patient gender: ${data.patientGender || 'unknown'}
Known conditions: ${data.knownConditions?.join(', ') || 'none specified'}
Current medications: ${data.currentMedications?.join(', ') || 'none specified'}

Assess the symptoms and recommend the appropriate level of care.

CRITICAL SAFETY RULES:
- If symptoms suggest a life-threatening condition (chest pain, difficulty breathing, severe bleeding, stroke symptoms, severe allergic reaction), recommend emergency care immediately
- If symptoms suggest urgent but non-life-threatening issues (high fever, severe pain, persistent vomiting), recommend urgent care
- If symptoms are mild and common (cold symptoms, minor aches), recommend self-care or scheduling a regular appointment
- Always err on the side of caution

Respond as JSON:
{
  "urgencyLevel": "self_care" | "schedule_appointment" | "urgent_care" | "emergency",
  "urgencyReason": "why this urgency level",
  "possibleCauses": ["possible explanations (non-diagnostic)"],
  "selfCareAdvice": ["self-care steps if appropriate"],
  "recommendedAction": "clear next step",
  "questionsToAskDoctor": ["questions for the visit"],
  "redFlagSymptoms": ["symptoms that would require immediate care"],
  "disclaimer": "This is not a medical diagnosis. Always consult a healthcare professional."
}`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.2,
        model: 'mistral',
      });
    } catch (err) {
      this.logger.error('Symptom assessment failed', err);
      throw err;
    }
  }

  /**
   * Check medication interactions for a patient's medication list
   */
  async checkMedicationInteractions(data: {
    medications: { name: string; dosage?: string; frequency?: string }[];
    newMedication?: { name: string; dosage?: string };
    patientAge?: number;
    patientGender?: string;
    knownConditions?: string[];
  }): Promise<{
    hasInteractions: boolean;
    interactions: {
      medications: string[];
      severity: 'minor' | 'moderate' | 'severe' | 'contraindicated';
      description: string;
      recommendation: string;
    }[];
    warnings: string[];
    recommendations: string[];
  }> {
    const medList = data.medications.map((m) => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join(', ');
    const newMed = data.newMedication
      ? `\nNew medication to check: ${data.newMedication.name} ${data.newMedication.dosage || ''}`
      : '';

    const prompt = `You are a medication safety assistant. Check for potential drug interactions.

Current medications: ${medList}${newMed}
Patient age: ${data.patientAge || 'unknown'}
Patient gender: ${data.patientGender || 'unknown'}
Known conditions: ${data.knownConditions?.join(', ') || 'none specified'}

Check for:
1. Drug-drug interactions
2. Drug-condition contraindications
3. Age-related concerns
4. Duplicate therapy

Respond as JSON:
{
  "hasInteractions": boolean,
  "interactions": [
    {
      "medications": ["the interacting drug names"],
      "severity": "minor" | "moderate" | "severe" | "contraindicated",
      "description": "what the interaction is",
      "recommendation": "what to do about it"
    }
  ],
  "warnings": ["general warnings"],
  "recommendations": ["overall recommendations"]
}

IMPORTANT: This is informational only. Patients should always consult their pharmacist or doctor about medication interactions.`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.2,
        model: 'mistral',
      });
    } catch (err) {
      this.logger.error('Medication interaction check failed', err);
      throw err;
    }
  }

  /**
   * Generate personalized health education based on patient's conditions
   */
  async generateHealthEducation(data: {
    conditions?: string[];
    medications?: string[];
    recentLabs?: { testName: string; value: string; flag?: string }[];
    interests?: string[];
  }): Promise<{
    articles: {
      title: string;
      category: string;
      summary: string;
      content: string;
      readTime: string;
    }[];
  }> {
    const prompt = `You are a personalized health education generator. Create educational content tailored to the patient's specific health profile.

Patient conditions: ${data.conditions?.join(', ') || 'none specified'}
Current medications: ${data.medications?.join(', ') || 'none specified'}
Recent lab results: ${data.recentLabs?.map((l) => `${l.testName}: ${l.value} (${l.flag || 'normal'})`).join(', ') || 'none'}
Patient interests: ${data.interests?.join(', ') || 'general wellness'}

Generate 3-5 personalized educational articles relevant to this patient's health profile.

Respond as JSON:
{
  "articles": [
    {
      "title": "article title",
      "category": "Diabetes | Heart Health | Medications | Lab Results | Exercise | Nutrition | General Wellness",
      "summary": "2-3 sentence summary",
      "content": "full article content in plain language (200-400 words)",
      "readTime": "estimated read time (e.g., '5 min')"
    }
  ]
}`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.5,
        model: 'mistral',
      });
    } catch (err) {
      this.logger.error('Health education generation failed', err);
      throw err;
    }
  }

  /**
   * Generate questions for the patient to ask their doctor at their next visit
   */
  async generateVisitQuestions(data: {
    conditions?: string[];
    medications?: string[];
    recentLabs?: { testName: string; value: string; flag?: string }[];
    upcomingAppointmentReason?: string;
  }): Promise<{
    questions: { question: string; category: string; priority: string }[];
    preparationTips: string[];
  }> {
    const prompt = `You are a patient advocacy assistant. Help the patient prepare for their upcoming doctor visit by generating relevant questions.

Patient conditions: ${data.conditions?.join(', ') || 'none specified'}
Current medications: ${data.medications?.join(', ') || 'none specified'}
Recent lab results: ${data.recentLabs?.map((l) => `${l.testName}: ${l.value} (${l.flag || 'normal'})`).join(', ') || 'none'}
Upcoming appointment reason: ${data.upcomingAppointmentReason || 'general visit'}

Generate 5-10 relevant questions the patient should ask their doctor, based on their health profile.

Respond as JSON:
{
  "questions": [
    {
      "question": "the question to ask",
      "category": "Medications | Symptoms | Lab Results | Lifestyle | Follow-up | Treatment",
      "priority": "high" | "medium" | "low"
    }
  ],
  "preparationTips": ["tips for making the most of the visit"]
}`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.4,
        model: 'mistral',
      });
    } catch (err) {
      this.logger.error('Visit questions generation failed', err);
      throw err;
    }
  }

  // ─── Medical & Family History AI Features ────────────────────────

  /**
   * AI extracts structured medical/family history from free-text patient input.
   * Patients can type or paste their history in natural language, and the AI
   * parses it into structured conditions, allergies, and family history entries.
   */
  async extractHistoryFromText(data: {
    freeText: string;
    patientAge?: number;
    patientGender?: string;
  }): Promise<{
    conditions: { description: string; code?: string; onsetDate?: string; notes?: string }[];
    allergies: { allergen: string; reaction?: string; severity?: string; onsetDate?: string }[];
    familyHistory: { relationship: string; condition: string; ageOfOnset?: number; isDeceased?: boolean; ageAtDeath?: number }[];
    surgeries: { procedure: string; date?: string; notes?: string }[];
    medications: { name: string; dosage?: string; frequency?: string }[];
    summary: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const prompt = `You are a medical data extraction assistant. A patient has provided their health history in free-text form. Extract structured data from it.

Patient free-text:
"""${data.freeText}"""

Patient age: ${data.patientAge || 'unknown'}
Patient gender: ${data.patientGender || 'unknown'}

Extract the following from the text:
1. Medical conditions (diagnoses, chronic diseases, past illnesses)
2. Allergies (drug, food, environmental, with reaction and severity if mentioned)
3. Family history (which relative, what condition, age of onset if mentioned, deceased status)
4. Surgeries/procedures (what, when, notes)
5. Current medications (name, dosage, frequency)

Respond as JSON:
{
  "conditions": [
    { "description": "condition name", "code": "ICD-10 code if known", "onsetDate": "YYYY-MM-DD or year if mentioned", "notes": "any additional context" }
  ],
  "allergies": [
    { "allergen": "allergen name", "reaction": "reaction description", "severity": "mild|moderate|severe|life-threatening", "onsetDate": "date if mentioned" }
  ],
  "familyHistory": [
    { "relationship": "father|mother|brother|sister|grandfather|grandmother|uncle|aunt|cousin|other", "condition": "condition name", "ageOfOnset": number_or_null, "isDeceased": boolean, "ageAtDeath": number_or_null }
  ],
  "surgeries": [
    { "procedure": "procedure name", "date": "date if mentioned", "notes": "any notes" }
  ],
  "medications": [
    { "name": "medication name", "dosage": "dosage if mentioned", "frequency": "frequency if mentioned" }
  ],
  "summary": "2-3 sentence summary of the patient's health history",
  "confidence": "high|medium|low (how confident you are in the extraction)"
}

Rules:
- Only extract what is explicitly stated. Do not infer or fabricate.
- Use standard ICD-10 codes if you can confidently identify the condition.
- If a field is not mentioned, use null or empty array.
- Severity should only be set if explicitly mentioned by the patient.`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.2,
        maxTokens: 4096,
      });
    } catch (err) {
      this.logger.error('History extraction from text failed', err);
      throw err;
    }
  }

  /**
   * AI assesses hereditary risk from family history data.
   * Identifies potential hereditary syndromes and recommends genetic counseling
   * if NCCN/ACMG criteria are met.
   */
  async assessFamilyHistoryRisk(data: {
    familyHistory: { relationship: string; condition: string; ageOfOnset?: number; isDeceased?: boolean; ageAtDeath?: number }[];
    patientAge?: number;
    patientGender?: string;
    patientConditions?: string[];
  }): Promise<{
    overallRiskLevel: 'low' | 'moderate' | 'high' | 'very_high';
    riskScore: number;
    identifiedRisks: {
      syndrome: string;
      riskLevel: string;
      reason: string;
      affectedRelatives: string[];
      recommendation: string;
    }[];
    recommendedScreenings: { screening: string; reason: string; recommendedAge: string; frequency: string }[];
    geneticCounselingRecommended: boolean;
    geneticCounselingReason: string;
    preventiveMeasures: string[];
    disclaimer: string;
  }> {
    const fhText = data.familyHistory
      .map((fh) => `${fh.relationship}: ${fh.condition}${fh.ageOfOnset ? ` (age ${fh.ageOfOnset})` : ''}${fh.isDeceased ? `, deceased${fh.ageAtDeath ? ` at age ${fh.ageAtDeath}` : ''}` : ''}`)
      .join('; ');

    const prompt = `You are a clinical genetics risk assessment assistant. Analyze the patient's family history and assess hereditary risk.

Family History:
${fhText || 'No family history provided'}

Patient age: ${data.patientAge || 'unknown'}
Patient gender: ${data.patientGender || 'unknown'}
Patient's own conditions: ${data.patientConditions?.join(', ') || 'none specified'}

Analyze for hereditary risk patterns including but not limited to:
- Hereditary breast and ovarian cancer (BRCA1/BRCA2) — early-onset breast cancer, ovarian cancer, male breast cancer, pancreatic cancer
- Lynch syndrome — colorectal cancer <50, endometrial cancer, multiple cancers
- Familial adenomatous polyposis (FAP)
- Hereditary hemochromatosis
- Familial hypercholesterolemia — early heart disease, high cholesterol
- Hypertrophic cardiomyopathy
- Long QT syndrome
- Type 2 diabetes family history
- Cardiovascular disease family history

Apply NCCN and ACMG criteria where applicable.

Respond as JSON:
{
  "overallRiskLevel": "low|moderate|high|very_high",
  "riskScore": number (0-100),
  "identifiedRisks": [
    {
      "syndrome": "name of the hereditary syndrome or risk pattern",
      "riskLevel": "low|moderate|high|very_high",
      "reason": "why this risk was identified (which family members, what conditions, what ages)",
      "affectedRelatives": ["which relatives are affected"],
      "recommendation": "what should be done (genetic testing, earlier screening, lifestyle changes)"
    }
  ],
  "recommendedScreenings": [
    { "screening": "screening test name", "reason": "why recommended", "recommendedAge": "at what age to start", "frequency": "how often" }
  ],
  "geneticCounselingRecommended": boolean,
  "geneticCounselingReason": "why genetic counseling is or isn't recommended",
  "preventiveMeasures": ["lifestyle and preventive steps"],
  "disclaimer": "This is an AI-based risk assessment for educational purposes only. It does not replace professional genetic counseling or clinical evaluation."
}

Be conservative — when in doubt, recommend professional evaluation.`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.2,
        maxTokens: 4096,
      });
    } catch (err) {
      this.logger.error('Family history risk assessment failed', err);
      throw err;
    }
  }

  /**
   * AI generates a plain-language health summary from the patient's
   * medical history, allergies, and family history. Organized by body system.
   */
  async generateHealthSummary(data: {
    conditions: { description: string; clinicalStatus?: string; onsetDate?: string; isChronic?: boolean }[];
    allergies: { allergen: string; reaction?: string; severity?: string }[];
    familyHistory: { relationship: string; condition: string }[];
    medications?: { name: string; dosage?: string }[];
    patientAge?: number;
    patientGender?: string;
  }): Promise<{
    summary: string;
    bodySystems: { system: string; conditions: string[]; recommendations: string[] }[];
    keyTakeaways: string[];
    riskFactors: string[];
    recommendedActions: string[];
    disclaimer: string;
  }> {
    const conditionsText = data.conditions
      .map((c) => `${c.description} (${c.clinicalStatus || 'unknown status'}${c.onsetDate ? `, since ${c.onsetDate}` : ''}${c.isChronic ? ', chronic' : ''})`)
      .join('; ') || 'none';

    const allergiesText = data.allergies
      .map((a) => `${a.allergen} (${a.severity || 'unknown severity'}${a.reaction ? `, reaction: ${a.reaction}` : ''})`)
      .join('; ') || 'none';

    const familyHistoryText = data.familyHistory
      .map((fh) => `${fh.relationship}: ${fh.condition}`)
      .join('; ') || 'none';

    const medicationsText = data.medications
      ?.map((m) => `${m.name} ${m.dosage || ''}`)
      .join('; ') || 'none';

    const prompt = `You are a patient-friendly health summary generator. Create a plain-language summary of the patient's complete health profile, organized by body system.

Patient age: ${data.patientAge || 'unknown'}
Patient gender: ${data.patientGender || 'unknown'}

Medical conditions: ${conditionsText}
Allergies: ${allergiesText}
Family history: ${familyHistoryText}
Current medications: ${medicationsText}

Create a comprehensive but easy-to-understand health summary. Organize conditions by body system (cardiovascular, endocrine, respiratory, musculoskeletal, neurological, gastrointestinal, mental health, etc.).

Respond as JSON:
{
  "summary": "3-5 sentence overall health summary in plain language",
  "bodySystems": [
    {
      "system": "body system name (e.g., Cardiovascular, Endocrine)",
      "conditions": ["conditions in this system, explained simply"],
      "recommendations": ["lifestyle or management tips for this system"]
    }
  ],
  "keyTakeaways": ["3-5 key points the patient should know about their health"],
  "riskFactors": ["identified risk factors based on conditions and family history"],
  "recommendedActions": ["actionable steps the patient should take (screenings, lifestyle changes, follow-ups)"],
  "disclaimer": "This summary is for educational purposes and is not a substitute for professional medical advice."
}

Write at a 6th-8th grade reading level. Avoid medical jargon where possible, or explain it when used.`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.4,
        maxTokens: 4096,
      });
    } catch (err) {
      this.logger.error('Health summary generation failed', err);
      throw err;
    }
  }

  /**
   * AI suggests health screenings based on the patient's medical history,
   * family history, age, and gender. Uses USPSTF and specialty guidelines.
   */
  async suggestScreenings(data: {
    conditions: { description: string; isChronic?: boolean }[];
    familyHistory: { relationship: string; condition: string; ageOfOnset?: number }[];
    patientAge: number;
    patientGender: string;
    medications?: string[];
  }): Promise<{
    recommendedScreenings: {
      screening: string;
      reason: string;
      urgency: 'routine' | 'recommended' | 'important' | 'urgent';
      recommendedFrequency: string;
      guidelineSource: string;
      relatedTo: string;
    }[];
    overdueScreenings: { screening: string; reason: string; lastRecommended: string }[];
    lifestyleRecommendations: string[];
    disclaimer: string;
  }> {
    const conditionsText = data.conditions.map((c) => c.description).join(', ') || 'none';
    const fhText = data.familyHistory
      .map((fh) => `${fh.relationship}: ${fh.condition}${fh.ageOfOnset ? ` (age ${fh.ageOfOnset})` : ''}`)
      .join('; ') || 'none';

    const prompt = `You are a preventive care screening recommendation assistant. Based on the patient's profile, recommend appropriate health screenings.

Patient age: ${data.patientAge}
Patient gender: ${data.patientGender}
Medical conditions: ${conditionsText}
Family history: ${fhText}
Current medications: ${data.medications?.join(', ') || 'none'}

Base recommendations on:
- USPSTF (US Preventive Services Task Force) guidelines
- Age and gender-appropriate routine screenings
- Condition-specific monitoring (e.g., HbA1c for diabetes, lipid panel for hyperlipidemia)
- Family history-triggered earlier or more frequent screenings (e.g., colonoscopy at 40 if family history of colorectal cancer)

Respond as JSON:
{
  "recommendedScreenings": [
    {
      "screening": "screening test name",
      "reason": "why this screening is recommended for this patient",
      "urgency": "routine|recommended|important|urgent",
      "recommendedFrequency": "how often (e.g., 'annually', 'every 5 years', 'one-time')",
      "guidelineSource": "USPSTF | ADA | AHA | ACS | ACC | other",
      "relatedTo": "what condition, risk factor, or age/gender guideline this relates to"
    }
  ],
  "overdueScreenings": [
    { "screening": "screening that may be overdue", "reason": "why it's overdue", "lastRecommended": "when it should have been done" }
  ],
  "lifestyleRecommendations": ["evidence-based lifestyle recommendations based on the patient's profile"],
  "disclaimer": "These recommendations are based on general guidelines. Your doctor may recommend a different screening schedule based on your individual health needs."
}`;

    try {
      return await this.aiService.generateStructured(prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });
    } catch (err) {
      this.logger.error('Screening suggestions failed', err);
      throw err;
    }
  }
}

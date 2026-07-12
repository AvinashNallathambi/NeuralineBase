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
}

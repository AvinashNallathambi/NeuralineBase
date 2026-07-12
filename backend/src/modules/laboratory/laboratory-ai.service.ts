import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { LaboratoryService } from './laboratory.service';
import { LabResult } from './entities/lab-result.entity';
import { LabTest } from './entities/lab-test.entity';
import { LabOrder } from './entities/lab-order.entity';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

export interface ResultSummary {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface TriageScore {
  resultId: string;
  testName: string;
  value: string;
  flag: string;
  triageScore: number; // 0-100
  triageCategory: 'normal' | 'abnormal' | 'urgent' | 'critical';
  reasoning: string;
  suggestedAction: string;
}

export interface NaturalLanguageQueryResult {
  interpretation: string;
  matchedOrders: Array<{
    orderId: string;
    patientName: string;
    testName: string;
    value: string;
    flag: string;
    status: string;
  }>;
  summary: string;
}

@Injectable()
export class LaboratoryAiService {
  private readonly logger = new Logger(LaboratoryAiService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly labService: LaboratoryService,
    @InjectRepository(LabResult)
    private readonly resultRepository: Repository<LabResult>,
    @InjectRepository(LabTest)
    private readonly testRepository: Repository<LabTest>,
    @InjectRepository(LabOrder)
    private readonly orderRepository: Repository<LabOrder>,
  ) {}

  // ───────────────────────────────────────────────────────────
  // AI Feature 1: Result Summarization
  // ───────────────────────────────────────────────────────────

  async summarizeLabResults(
    tenantId: string,
    orderId: string,
  ): Promise<ResultSummary> {
    // Fetch order with details
    const order = await this.labService.findOrderWithDetails(tenantId, orderId);
    const results = order.results || [];
    const tests = order.tests || [];

    if (results.length === 0) {
      return {
        summary: 'No results have been submitted for this order yet.',
        keyFindings: [],
        recommendations: ['Wait for lab results to be submitted.'],
        riskLevel: 'low',
      };
    }

    // Build structured data for the prompt
    const resultData = results.map((r) => {
      const test = tests.find((t) => t.id === r.testId);
      return {
        testName: test?.name || 'Unknown Test',
        value: r.value,
        unit: r.unit,
        flag: r.flag,
        referenceRange: r.referenceRange,
        interpretation: r.interpretation,
      };
    });

    const prompt = `You are a clinical laboratory AI assistant. Analyze the following lab results and provide a structured summary.

PATIENT: ${order.patientName}
ORDER DATE: ${order.orderedDate}
PRIORITY: ${order.priority}

LAB RESULTS (JSON):
${JSON.stringify(resultData, null, 2)}

Provide your analysis as a JSON object with these exact fields:
{
  "summary": "A 2-3 sentence plain-English summary of the overall results suitable for a provider to quickly review.",
  "keyFindings": ["List of notable findings, especially abnormal or critical values, as an array of short strings"],
  "recommendations": ["List of suggested clinical follow-up actions as an array of short strings"],
  "riskLevel": "One of: low, moderate, high, critical — based on the severity of abnormal results"
}

Guidelines:
- Use clinical terminology appropriate for a healthcare provider
- Highlight critical values prominently
- Note trends if multiple results show related abnormalities
- Be concise but thorough
- Do not make definitive diagnoses — suggest further evaluation where appropriate`;

    try {
      this.logger.debug(
        `Generating AI summary for order ${orderId} (${results.length} results)`,
      );
      const summary = await this.aiService.generateStructured<ResultSummary>(
        prompt,
        { temperature: 0.2, maxTokens: 1024 },
      );
      return summary;
    } catch (error: any) {
      this.logger.error(`AI summarization failed: ${error.message}`);
      throw new InternalServerErrorException(
        'AI summarization failed. Ensure Ollama is running.',
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // AI Feature 2: Smart Abnormal Triage
  // ───────────────────────────────────────────────────────────

  async triageAbnormalResults(tenantId: string): Promise<TriageScore[]> {
    // Fetch all results with abnormal flags
    const abnormalResults = await this.resultRepository.find({
      where: { tenantId },
      order: { resultedAt: 'DESC' },
      take: 200,
    });

    // Filter to only abnormal/critical results
    const flagged = abnormalResults.filter(
      (r) => r.flag && r.flag !== 'normal',
    );

    if (flagged.length === 0) {
      return [];
    }

    // Get test names for these results
    const testIds = [...new Set(flagged.map((r) => r.testId))];
    const tests = await this.testRepository.find({
      where: { tenantId, id: In(testIds) },
    });
    const testMap = new Map(tests.map((t) => [t.id, t]));

    // Build data for AI
    const resultsForAI = flagged.map((r) => ({
      resultId: r.id,
      testName: testMap.get(r.testId)?.name || 'Unknown',
      value: r.value,
      unit: r.unit,
      flag: r.flag,
      referenceRange: r.referenceRange,
      numericValue: r.numericValue,
      resultedAt: r.resultedAt,
    }));

    const prompt = `You are a clinical triage AI assistant. Score the clinical urgency of each abnormal lab result.

ABNORMAL LAB RESULTS (JSON):
${JSON.stringify(resultsForAI, null, 2)}

For each result, assign a triage score (0-100) and category based on:
- How far the value deviates from the reference range
- The clinical significance of the abnormality
- Potential for patient harm if not addressed
- Whether this is a critical value requiring immediate action

Return a JSON object with this exact structure:
{
  "triage": [
    {
      "resultId": "the result ID",
      "testName": "test name",
      "value": "the value",
      "flag": "the flag",
      "triageScore": <number 0-100>,
      "triageCategory": "one of: normal, abnormal, urgent, critical",
      "reasoning": "1-2 sentence explanation of the score",
      "suggestedAction": "Recommended clinical action"
    }
  ]
}

Scoring guide:
- 80-100 (critical): Immediate action required, potential life-threatening
- 60-79 (urgent): Needs prompt attention within hours
- 30-59 (abnormal): Needs review, not immediately dangerous
- 0-29 (normal): Mild deviation, routine follow-up`;

    try {
      this.logger.debug(
        `Triaging ${flagged.length} abnormal results with AI`,
      );
      const response = await this.aiService.generateStructured<{
        triage: TriageScore[];
      }>(prompt, { temperature: 0.1, maxTokens: 2048 });

      // Sort by triage score descending (most urgent first)
      return (response.triage || []).sort(
        (a, b) => b.triageScore - a.triageScore,
      );
    } catch (error: any) {
      this.logger.error(`AI triage failed: ${error.message}`);
      // Fallback: rule-based triage without AI
      return this.fallbackTriage(flagged, testMap);
    }
  }

  private fallbackTriage(
    results: LabResult[],
    testMap: Map<string, LabTest>,
  ): TriageScore[] {
    return results
      .map((r) => {
        const test = testMap.get(r.testId);
        const isCritical = r.flag?.startsWith('critical');
        const score = isCritical ? 90 : r.flag === 'high' || r.flag === 'low' ? 50 : 20;
        return {
          resultId: r.id,
          testName: test?.name || 'Unknown',
          value: r.value,
          flag: r.flag || 'normal',
          triageScore: score,
          triageCategory: (isCritical ? 'critical' : 'abnormal') as TriageScore['triageCategory'],
          reasoning: `Rule-based: ${r.flag} flag detected`,
          suggestedAction: isCritical
            ? 'Immediate provider notification and acknowledgment required'
            : 'Review at next available opportunity',
        };
      })
      .sort((a, b) => b.triageScore - a.triageScore);
  }

  // ───────────────────────────────────────────────────────────
  // AI Feature 3: Natural Language Lab Query
  // ───────────────────────────────────────────────────────────

  async naturalLanguageQuery(
    tenantId: string,
    query: string,
  ): Promise<NaturalLanguageQueryResult> {
    // First, use AI to extract structured criteria from the natural language query
    const parsePrompt = `You are a clinical data assistant. A provider wants to search lab results using a natural language query.

QUERY: "${query}"

Extract the search criteria as a JSON object with this structure:
{
  "testNames": ["array of test name keywords to match (e.g. "HbA1c", "creatinine", "glucose")"],
  "flags": ["array of flags to filter by (e.g. "critical_high", "high", "abnormal") — empty if not specified"],
  "statuses": ["array of order statuses to filter by — empty if not specified"],
  "patientName": "patient name keyword if mentioned, empty string if not"
}

Examples:
- "Which patients have uncontrolled diabetes?" → {"testNames": ["HbA1c", "glucose"], "flags": ["high", "critical_high"], "statuses": [], "patientName": ""}
- "Show me all critical results" → {"testNames": [], "flags": ["critical_high", "critical_low"], "statuses": [], "patientName": ""}
- "John's creatinine results" → {"testNames": ["creatinine"], "flags": [], "statuses": [], "patientName": "John"}`;

    let criteria: {
      testNames: string[];
      flags: string[];
      statuses: string[];
      patientName: string;
    };

    try {
      this.logger.debug(`Parsing NL query: "${query}"`);
      criteria = await this.aiService.generateStructured(parsePrompt, {
        temperature: 0.1,
        maxTokens: 512,
      });
    } catch (error: any) {
      this.logger.error(`AI query parsing failed: ${error.message}`);
      // Fallback: simple keyword search
      criteria = {
        testNames: query.split(/\s+/).filter((w) => w.length > 2),
        flags: [],
        statuses: [],
        patientName: '',
      };
    }

    // Query the database based on extracted criteria
    const orderQb = this.orderRepository
      .createQueryBuilder('order')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.deletedAt IS NULL');

    if (criteria.patientName) {
      orderQb.andWhere('order.patientName ILIKE :patientName', {
        patientName: `%${criteria.patientName}%`,
      });
    }
    if (criteria.statuses.length > 0) {
      orderQb.andWhere('order.status IN (:...statuses)', {
        statuses: criteria.statuses,
      });
    }

    const orders = await orderQb
      .orderBy('order.orderedDate', 'DESC')
      .take(100)
      .getMany();

    if (orders.length === 0) {
      return {
        interpretation: `No orders found matching: "${query}"`,
        matchedOrders: [],
        summary: 'No matching lab orders found.',
      };
    }

    // Get tests and results for these orders
    const orderIds = orders.map((o) => o.id);
    const tests = await this.testRepository.find({
      where: { tenantId, orderId: In(orderIds) },
    });
    const results = await this.resultRepository.find({
      where: { tenantId, orderId: In(orderIds) },
    });

    // Build matched results list
    const matchedOrders: NaturalLanguageQueryResult['matchedOrders'] = [];

    for (const result of results) {
      const test = tests.find((t) => t.id === result.testId);
      const order = orders.find((o) => o.id === result.orderId);
      if (!test || !order) continue;

      // Filter by test name keywords
      if (criteria.testNames.length > 0) {
        const matchesTest = criteria.testNames.some(
          (kw) =>
            test.name.toLowerCase().includes(kw.toLowerCase()) ||
            (test.loincCode || '').toLowerCase().includes(kw.toLowerCase()),
        );
        if (!matchesTest) continue;
      }

      // Filter by flags
      if (criteria.flags.length > 0) {
        if (!result.flag || !criteria.flags.includes(result.flag)) continue;
      }

      matchedOrders.push({
        orderId: order.id,
        patientName: order.patientName,
        testName: test.name,
        value: result.value,
        flag: result.flag || 'normal',
        status: order.status,
      });
    }

    // Also include pending tests that match test name criteria (no results yet)
    if (criteria.testNames.length > 0 && matchedOrders.length < 50) {
      for (const test of tests) {
        // Skip if we already have a result for this test
        if (results.some((r) => r.testId === test.id)) continue;
        const order = orders.find((o) => o.id === test.orderId);
        if (!order) continue;

        const matchesTest = criteria.testNames.some(
          (kw) =>
            test.name.toLowerCase().includes(kw.toLowerCase()) ||
            (test.loincCode || '').toLowerCase().includes(kw.toLowerCase()),
        );
        if (!matchesTest) continue;

        matchedOrders.push({
          orderId: order.id,
          patientName: order.patientName,
          testName: test.name,
          value: 'Pending',
          flag: 'pending',
          status: order.status,
        });
      }
    }

    // Generate AI summary of the matched results
    let summary = `Found ${matchedOrders.length} matching result(s).`;
    if (matchedOrders.length > 0) {
      try {
        const summaryPrompt = `A provider searched lab results with: "${query}". Here are the matching results:

${JSON.stringify(matchedOrders.slice(0, 20), null, 2)}

Write a 1-2 sentence summary of what was found. Mention specific patients and values if relevant. Be clinically precise.`;

        summary = await this.aiService.generate(summaryPrompt, {
          temperature: 0.2,
          maxTokens: 256,
        });
      } catch {
        // Keep default summary if AI fails
      }
    }

    return {
      interpretation: `Parsed criteria: testNames=[${criteria.testNames.join(', ')}], flags=[${criteria.flags.join(', ')}], patient="${criteria.patientName}"`,
      matchedOrders: matchedOrders.slice(0, 100),
      summary,
    };
  }
}

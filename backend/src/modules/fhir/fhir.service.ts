import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PatientsService } from '../patients/patients.service';

export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id: string;
  type: string;
  total: number;
  link: Array<{ relation: string; url: string }>;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
}

interface PatientSearchParams {
  name?: string;
  family?: string;
  given?: string;
  birthdate?: string;
  gender?: string;
  identifier?: string;
  count: number;
}

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);
  private readonly fhirBaseUrl: string;

  constructor(
    private readonly patientsService: PatientsService,
    private readonly configService: ConfigService,
  ) {
    this.fhirBaseUrl = this.configService.get<string>(
      'FHIR_BASE_URL',
      'http://localhost:4000/api/v1/fhir',
    );
  }

  /**
   * FHIR R4 CapabilityStatement
   */
  getCapabilityStatement(): FhirResource {
    return {
      resourceType: 'CapabilityStatement',
      id: 'neuraline-emr',
      url: `${this.fhirBaseUrl}/metadata`,
      version: '1.0.0',
      name: 'NeuralineEMRCapabilityStatement',
      title: 'Neuraline EMR FHIR R4 Capability Statement',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'Neuraline Health',
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['json'],
      rest: [
        {
          mode: 'server',
          resource: [
            {
              type: 'Patient',
              interaction: [
                { code: 'read' },
                { code: 'search-type' },
              ],
              searchParam: [
                { name: 'name', type: 'string' },
                { name: 'family', type: 'string' },
                { name: 'given', type: 'string' },
                { name: 'birthdate', type: 'date' },
                { name: 'gender', type: 'token' },
                { name: 'identifier', type: 'token' },
              ],
            },
            {
              type: 'Encounter',
              interaction: [{ code: 'read' }],
            },
            {
              type: 'MedicationRequest',
              interaction: [{ code: 'read' }],
            },
            {
              type: 'DiagnosticReport',
              interaction: [{ code: 'read' }],
            },
            {
              type: 'Claim',
              interaction: [{ code: 'read' }],
            },
          ],
        },
      ],
    };
  }

  /**
   * Transform internal Patient to FHIR R4 Patient resource
   */
  async getPatientResource(
    tenantId: string,
    patientId: string,
  ): Promise<FhirResource> {
    const patient = await this.patientsService.findOne(tenantId, patientId);

    return {
      resourceType: 'Patient',
      id: patient.id,
      meta: {
        versionId: '1',
        lastUpdated: patient.updatedAt.toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
      },
      identifier: patient.mrn
        ? [
            {
              use: 'usual',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'MR',
                    display: 'Medical Record Number',
                  },
                ],
              },
              value: patient.mrn,
            },
          ]
        : [],
      active: patient.status === 'active',
      name: [
        {
          use: 'official',
          family: patient.lastName,
          given: [patient.firstName],
        },
      ],
      telecom: [
        ...(patient.phone
          ? [{ system: 'phone', value: patient.phone, use: 'home' }]
          : []),
        ...(patient.email
          ? [{ system: 'email', value: patient.email }]
          : []),
      ],
      gender: patient.gender,
      birthDate: patient.dateOfBirth
        ? new Date(patient.dateOfBirth).toISOString().split('T')[0]
        : undefined,
      address: patient.address
        ? [
            {
              use: 'home',
              line: [
                patient.address.street1,
                ...(patient.address.street2 ? [patient.address.street2] : []),
              ],
              city: patient.address.city,
              state: patient.address.state,
              postalCode: patient.address.zipCode,
              country: patient.address.country,
            },
          ]
        : [],
      contact: patient.emergencyContact
        ? [
            {
              relationship: [
                {
                  coding: [
                    {
                      system:
                        'http://terminology.hl7.org/CodeSystem/v2-0131',
                      code: 'C',
                      display: 'Emergency Contact',
                    },
                  ],
                  text: patient.emergencyContact.relationship,
                },
              ],
              name: { text: patient.emergencyContact.name },
              telecom: [
                {
                  system: 'phone',
                  value: patient.emergencyContact.phone,
                },
              ],
            },
          ]
        : [],
    };
  }

  /**
   * Search patients and return FHIR Bundle
   */
  async searchPatients(
    tenantId: string,
    params: PatientSearchParams,
  ): Promise<FhirBundle> {
    const search =
      params.name || params.family || params.given || params.identifier || '';
    const gender = params.gender;

    const result = await this.patientsService.findAll(tenantId, {
      page: 1,
      limit: params.count,
      search,
      gender,
    });

    const entries = await Promise.all(
      result.data.map(async (patient) => {
        const resource = await this.getPatientResource(tenantId, patient.id);
        return {
          fullUrl: `${this.fhirBaseUrl}/Patient/${patient.id}`,
          resource,
        };
      }),
    );

    return {
      resourceType: 'Bundle',
      id: `search-${Date.now()}`,
      type: 'searchset',
      total: result.total,
      link: [
        {
          relation: 'self',
          url: `${this.fhirBaseUrl}/Patient`,
        },
      ],
      entry: entries,
    };
  }

  /**
   * Get FHIR Encounter resource
   */
  async getEncounterResource(
    tenantId: string,
    encounterId: string,
  ): Promise<FhirResource> {
    // TODO: Implement with actual encounter data
    this.logger.log(
      `FHIR Encounter requested: ${encounterId} (tenant: ${tenantId})`,
    );

    return {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
    };
  }

  /**
   * Get FHIR MedicationRequest resource
   */
  async getMedicationRequestResource(
    tenantId: string,
    prescriptionId: string,
  ): Promise<FhirResource> {
    // TODO: Implement with actual prescription data
    this.logger.log(
      `FHIR MedicationRequest requested: ${prescriptionId} (tenant: ${tenantId})`,
    );

    return {
      resourceType: 'MedicationRequest',
      id: prescriptionId,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      status: 'active',
      intent: 'order',
    };
  }

  /**
   * Get FHIR DiagnosticReport resource
   */
  async getDiagnosticReportResource(
    tenantId: string,
    reportId: string,
  ): Promise<FhirResource> {
    // TODO: Implement with actual lab report data
    this.logger.log(
      `FHIR DiagnosticReport requested: ${reportId} (tenant: ${tenantId})`,
    );

    return {
      resourceType: 'DiagnosticReport',
      id: reportId,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      status: 'final',
      code: {
        text: 'Diagnostic Report',
      },
    };
  }

  /**
   * Get FHIR Claim resource
   */
  async getClaimResource(
    tenantId: string,
    claimId: string,
  ): Promise<FhirResource> {
    // TODO: Implement with actual billing/claim data
    this.logger.log(
      `FHIR Claim requested: ${claimId} (tenant: ${tenantId})`,
    );

    return {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
          },
        ],
      },
      use: 'claim',
    };
  }
}

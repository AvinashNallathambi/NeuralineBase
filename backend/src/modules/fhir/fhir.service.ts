import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PatientsService } from '../patients/patients.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientImmunization } from '../immunizations/entities/patient-immunization.entity';
import { Encounter } from '../clinical/entities/encounter.entity';

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
    @InjectRepository(PatientImmunization)
    private readonly immunizationRepository: Repository<PatientImmunization>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
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

  /**
   * Get FHIR Immunization resource
   * Maps from PatientImmunization entity to FHIR R4 Immunization
   */
  async getImmunizationResource(
    tenantId: string,
    immunizationId: string,
  ): Promise<FhirResource> {
    this.logger.log(`FHIR Immunization requested: ${immunizationId} (tenant: ${tenantId})`);

    const imm = await this.immunizationRepository.findOne({
      where: { id: immunizationId, tenantId },
    });
    if (!imm) throw new NotFoundException('Immunization not found');

    const statusMap: Record<string, string> = {
      completed: 'completed',
      'entered-in-error': 'entered-in-error',
      'not-done': 'not-done',
    };

    const resource: FhirResource = {
      resourceType: 'Immunization',
      id: imm.id,
      meta: {
        versionId: '1',
        lastUpdated: imm.updatedAt.toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Immunization'],
      },
      status: statusMap[imm.status] || 'completed',
      vaccineCode: {
        coding: [
          ...(imm.cvxCode ? [{
            system: 'http://hl7.org/fhir/sid/cvx',
            code: imm.cvxCode,
            display: imm.vaccineName,
          }] : []),
          ...(imm.cptCode ? [{
            system: 'http://www.ama-assn.org/go/cpt',
            code: imm.cptCode,
          }] : []),
        ],
        text: imm.vaccineName,
      },
      patient: { reference: `Patient/${imm.patientId}` },
      occurrenceDateTime: imm.administeredDate,
      recorded: imm.createdAt.toISOString(),
      primarySource: imm.source === 'administered',
      ...(imm.lotNumber && {
        lotNumber: imm.lotNumber,
      }),
      ...(imm.expirationDate && {
        expirationDate: imm.expirationDate,
      }),
      ...(imm.manufacturer && {
        manufacturer: { display: imm.manufacturer },
      }),
      ...(imm.doseAmount && {
        doseQuantity: {
          value: parseFloat(imm.doseAmount),
          ...(imm.doseUnit && { unit: imm.doseUnit }),
        },
      }),
      ...(imm.route && {
        route: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
            code: imm.route,
          }],
        },
      }),
      ...(imm.site && {
        site: {
          text: imm.site,
        },
      }),
      ...(imm.providerName && {
        performer: [{
          actor: { display: imm.providerName },
          ...(imm.providerId && { reference: `Practitioner/${imm.providerId}` }),
        }],
      }),
      ...(imm.facilityName && {
        location: { display: imm.facilityName },
      }),
      ...(imm.reactionNotes && {
        reaction: [{
          detail: { text: imm.reactionNotes },
        }],
      }),
      ...(imm.notes && {
        note: [{ text: imm.notes }],
      }),
    };

    return resource;
  }

  /**
   * Search FHIR Immunization resources for a patient
   */
  async searchImmunizations(
    tenantId: string,
    patientId: string,
  ): Promise<FhirBundle> {
    this.logger.log(`FHIR Immunization search for patient: ${patientId} (tenant: ${tenantId})`);

    const imms = await this.immunizationRepository.find({
      where: { patientId, tenantId },
      order: { administeredDate: 'DESC' },
    });

    return {
      resourceType: 'Bundle',
      id: `immunization-search-${patientId}`,
      type: 'searchset',
      total: imms.length,
      link: [],
      entry: imms.map((imm) => ({
        fullUrl: `${this.fhirBaseUrl}/Immunization/${imm.id}`,
        resource: {
          resourceType: 'Immunization',
          id: imm.id,
          meta: { lastUpdated: imm.updatedAt.toISOString() },
          status: imm.status === 'completed' ? 'completed' : 'not-done',
          vaccineCode: { text: imm.vaccineName },
          patient: { reference: `Patient/${imm.patientId}` },
          occurrenceDateTime: imm.administeredDate,
        },
      })),
    };
  }

  /**
   * Get FHIR Observation resources for growth measurements from encounter vitals.
   * Maps weight, height, head circumference, and BMI to FHIR R4 Observation resources
   * with appropriate LOINC codes.
   */
  async getGrowthObservations(
    tenantId: string,
    patientId: string,
  ): Promise<FhirBundle> {
    this.logger.log(`FHIR growth Observations for patient: ${patientId} (tenant: ${tenantId})`);

    const encounters = await this.encounterRepository.find({
      where: { patientId, tenantId },
      order: { startTime: 'ASC' },
    });

    const observations: FhirResource[] = [];

    const loincCodes: Record<string, { code: string; display: string; unit: string }> = {
      weight: { code: '29463-7', display: 'Body Weight', unit: 'kg' },
      height: { code: '8302-2', display: 'Body Height', unit: 'cm' },
      headCircumference: { code: '9843-4', display: 'Head Occipital-frontal Circumference', unit: 'cm' },
      bmi: { code: '39156-5', display: 'Body Mass Index', unit: 'kg/m2' },
    };

    for (const enc of encounters) {
      if (!enc.vitals) continue;
      const v = enc.vitals;
      const effectiveDate = v.recordedDate || enc.startTime?.toISOString() || enc.createdAt?.toISOString();

      for (const [field, loinc] of Object.entries(loincCodes)) {
        const rawValue = (v as any)[field];
        if (!rawValue) continue;
        const value = parseFloat(rawValue);
        if (isNaN(value) || value <= 0) continue;

        observations.push({
          resourceType: 'Observation',
          id: `${enc.id}-${field}`,
          meta: {
            lastUpdated: enc.updatedAt?.toISOString() || new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns'],
          },
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            }],
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: loinc.code,
              display: loinc.display,
            }],
            text: loinc.display,
          },
          subject: { reference: `Patient/${patientId}` },
          encounter: { reference: `Encounter/${enc.id}` },
          effectiveDateTime: effectiveDate,
          valueQuantity: {
            value: value,
            unit: loinc.unit,
            system: 'http://unitsofmeasure.org',
            code: loinc.unit,
          },
        });
      }
    }

    return {
      resourceType: 'Bundle',
      id: `growth-observations-${patientId}`,
      type: 'searchset',
      total: observations.length,
      link: [],
      entry: observations.map((obs) => ({
        fullUrl: `${this.fhirBaseUrl}/Observation/${obs.id}`,
        resource: obs,
      })),
    };
  }
}

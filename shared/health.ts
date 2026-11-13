export const healthProjectMarker = '<!-- FAMILY_HEALTH_PROJECT -->';
export const healthProjectTitle = '基础生活｜健｜健康管理';

export interface HealthMember {
  id: string;
  name: string;
  birthDate: string;
  relationship: string;
  management: 'general' | 'risk' | 'stable' | 'changing';
  conditions: string;
  allergies: string;
  emergencyContact: string;
  doctor: string;
  hospital: string;
  doctorContact: string;
  goals: string;
  monitoringPlan: string;
  consent: boolean;
}

export type MeasurementKind = 'bloodPressure' | 'weight' | 'sleep' | 'activity' | 'glucose' | 'temperature';
export interface HealthMeasurement {
  id: string;
  memberId: string;
  kind: MeasurementKind;
  measuredAt: string;
  value: number;
  secondary: number | null;
  context: string;
  source: 'self' | 'device' | 'clinic';
  note: string;
}

export interface HealthAction {
  id: string;
  memberId: string;
  title: string;
  category: 'lifestyle' | 'medication' | 'followup' | 'prevention' | 'other';
  dueDate: string;
  owner: string;
  focus: boolean;
  status: 'todo' | 'doing' | 'waiting' | 'done';
  evidence: string;
  obstacle: string;
  recurrence?: 'none' | 'daily' | 'weekly';
}

export interface HealthMedication {
  id: string;
  memberId: string;
  name: string;
  strength: string;
  dose: string;
  schedule: string;
  purpose: string;
  prescriber: string;
  notes: string;
  reviewDate: string;
}

export interface HealthVisit {
  id: string;
  memberId: string;
  date: string;
  institution: string;
  reason: string;
  questions: string;
  status: 'planned' | 'waiting' | 'done';
  outcome: string;
  nextDate: string;
}

export interface HealthReview {
  id: string;
  memberId: string;
  date: string;
  changes: string;
  support: string;
  nextSteps: string;
  simplify: string;
}

export interface HealthWorkspace {
  members: HealthMember[];
  measurements: HealthMeasurement[];
  actions: HealthAction[];
  medications: HealthMedication[];
  visits: HealthVisit[];
  reviews: HealthReview[];
}

export interface HealthSnapshot {
  version: number;
  updatedAt: string | null;
  data: HealthWorkspace;
}

export function emptyHealthWorkspace(): HealthWorkspace {
  return { members: [], measurements: [], actions: [], medications: [], visits: [], reviews: [] };
}

export interface Role {
  id: number;
  roleName: string;
}

export interface UserRow {
  id: number;
  username: string;
  email: string;
  enabled: boolean;
  createdAt: string;
  role: Role | null;
  /** Hash bcrypt; se conserva al editar (el backend reemplaza el registro completo). */
  password?: string;
}

export interface Elderly {
  id: number;
  user: UserRow | null;
  name: string | null;
  dni: string;
  bloodType: string;
  gender: string;
  height: number;
  allergies: string;
  currentWeight: number;
  chronicDiseases: string;
  currentMedication: string;
  medicalObservations: string;
}

export interface ElderlyPayload {
  id?: number;
  user?: { id: number } | null;
  name: string;
  dni: string;
  bloodType: string;
  gender: string;
  height: number | null;
  allergies: string;
  currentWeight: number | null;
  chronicDiseases: string;
  currentMedication: string;
  medicalObservations: string;
}

export interface HealthCenter {
  id: number;
  centerName: string;
  latitude: number;
  longitude: number;
  emergencyPhone: string;
  address: string;
  rating: number;
}

export interface HealthCenterPayload {
  id?: number;
  centerName: string;
  latitude: number | null;
  longitude: number | null;
  emergencyPhone: string;
  address: string;
  rating: number | null;
}

export interface Nurse {
  id: number;
  user: UserRow | null;
  licenseNumber: string;
}

export interface Monitoring {
  id: number;
  elderly: Elderly | null;
  nurse: Nurse | null;
  vitalSignsStatus: string;
  monitoringDate: string;
  monitoringTime: string;
  temperature: number;
  bloodPressure: string;
  observations: string;
  medicineStatus: string;
}

export interface MonitoringPayload {
  elderly: { id: number };
  nurse: { id: number };
  vitalSignsStatus: string;
  monitoringDate: string;
  monitoringTime: string;
  temperature: number;
  bloodPressure: string;
  observations: string;
  medicineStatus: string;
}

export interface CalendarEntry {
  id: number;
  elderly: Elderly | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  medicineDate: string | null;
  medicineTime: string | null;
  therapyDate: string | null;
  therapyTime: string | null;
  vaccines: string | null;
}

export type CalendarPayload = Partial<Omit<CalendarEntry, 'id' | 'elderly'>> & {
  elderly?: { id: number };
};

export interface SubscribePayload {
  planType: string;
  method: string;
}

export interface Guardian {
  id: number;
  user: UserRow | null;
  phone: string;
  address: string;
  relationship: string;
  dni: string;
}

export interface Subscription {
  id: number;
  guardian: Guardian | null;
  planType: string;
  startDate: string;
  expiryDate: string;
  status: string;
  price: number;
  discount: number;
}

export interface Payment {
  id: number;
  subscription: Subscription | null;
  paymentDate: string;
  paymentTime: string;
  amount: number;
  status: string;
}

export interface CountResult {
  count: number;
}

export interface Subscription {
  plan: 'none' | 'trial' | 'monthly' | 'annual';
  status: 'active' | 'inactive' | 'expired';
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'coach' | 'athlete';
  coach_id?: string;
  subscription?: Subscription;
}

export interface BiometricData {
  heart_rate_max?: number;
  heart_rate_rest?: number;
  vo2_max?: number;
  lactate_threshold?: number;
  weight?: number;
  height?: number;
  custom_metrics?: Record<string, any>;
}

export interface MedicalCertificate {
  issue_date?: string;
  expiry_date?: string;
  document_base64?: string;
}

export interface PaymentRecord {
  id: string;
  month: string;
  amount: number;
  paid: boolean;
  paid_date?: string;
  due_date: string;
}

export interface AthleteProfile {
  id: string;
  coach_id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  birth_date?: string;
  notes?: string;
  biometrics: BiometricData;
  medical_certificate: MedicalCertificate;
  payments: PaymentRecord[];
  connected_platforms: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSession {
  id: string;
  day: string;
  title: string;
  description: string;
  workout_type: string;
  duration_minutes?: number;
  distance_km?: number;
  target_pace?: string;
  heart_rate_zone?: string;
  power_zone?: string;
  notes?: string;
  completed: boolean;
  completed_date?: string;
  actual_data?: Record<string, any>;
}

export interface TrainingProgram {
  id: string;
  coach_id: string;
  athlete_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  goal?: string;
  workouts: WorkoutSession[];
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  message: string;
  notification_type: string;
  read: boolean;
  created_at: string;
}

export interface ActivityData {
  id: string;
  athlete_id: string;
  date: string;
  activity_type: string;
  duration_minutes: number;
  distance_km?: number;
  avg_pace?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  calories?: number;
  elevation_gain?: number;
  avg_power?: number;
  source: string;
}

export interface ExpiryWarning {
  type: 'certificate_expiry' | 'payment_due';
  athlete_id: string;
  athlete_name: string;
  days_until?: number;
  days_overdue?: number;
  expiry_date?: string;
  payment_id?: string;
  month?: string;
  amount?: number;
  urgent: boolean;
}

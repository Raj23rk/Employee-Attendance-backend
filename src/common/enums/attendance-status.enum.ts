export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  LEAVE = 'LEAVE',
  WFH = 'WFH',
  WEEK_OFF = 'WEEK_OFF',
  HOLIDAY = 'HOLIDAY',
}

export enum AttendanceSource {
  WEB = 'WEB',
  BIOMETRIC = 'BIOMETRIC',
  MOBILE = 'MOBILE',
  MANUAL_CORRECTION = 'MANUAL_CORRECTION',
}

export enum CorrectionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type CertificateFieldConfig = {
  field: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  text?: string;
};

export type CertificateIssueDateMode = 'current_date' | 'manual';

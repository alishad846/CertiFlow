export type CertificateFieldConfig = {
  field: string;
  pageNumber?: number;
  x: number;
  y: number;
  width: number;
  height?: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  rotation?: number;
  locked?: boolean;
  align: 'left' | 'center' | 'right';
  text?: string;
};

export type CertificateIssueDateMode = 'current_date' | 'manual';

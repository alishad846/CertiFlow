import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { getVerification } from '../services/certificates';

type LinkVerificationResult = {
  status: 'verified' | 'suspicious' | 'invalid';
  trustScore: number;
  issuer: string;
  documentType: string;
  studentName: string;
  courseName: string;
  certificateId: string;
  verifiedUrl: string;
  reason: string;
};

function detectVerificationProvider(link: string): string {
  try {
    const hostname = new URL(link).hostname.toLowerCase();

    if (
      hostname === 'coursera.org' ||
      hostname === 'www.coursera.org'
    ) {
      return 'coursera';
    }

    if (hostname === 'learn.microsoft.com') {
      return 'microsoft';
    }

    if (
      hostname === 'aws.amazon.com' ||
      hostname.endsWith('.aws.amazon.com')
    ) {
      return 'aws';
    }

    if (
      hostname === 'cloudskillsboost.google' ||
      hostname.endsWith('.cloudskillsboost.google')
    ) {
      return 'google';
    }

    if (
      hostname === 'cisco.com' ||
      hostname.endsWith('.cisco.com')
    ) {
      return 'cisco';
    }

    if (
      hostname === 'oracle.com' ||
      hostname.endsWith('.oracle.com')
    ) {
      return 'oracle';
    }

    return 'unknown';
  } catch {
    return 'invalid';
  }
}

async function verifyCourseraLink(
  inputUrl: string
): Promise<LinkVerificationResult> {
  const invalidResult: LinkVerificationResult = {
    status: 'invalid',
    trustScore: 0,
    issuer: 'Coursera',
    documentType: 'Course Certificate',
    studentName: 'Name not detected',
    courseName: 'Course not detected',
    certificateId: 'ID not detected',
    verifiedUrl: inputUrl,
    reason: 'Invalid or inaccessible Coursera verification link',
  };

  try {
    const parsedUrl = new URL(inputUrl.trim());

    const allowedHosts = new Set([
      'coursera.org',
      'www.coursera.org',
    ]);

    if (
      parsedUrl.protocol !== 'https:' ||
      !allowedHosts.has(parsedUrl.hostname.toLowerCase())
    ) {
      return {
        ...invalidResult,
        status: 'suspicious',
        trustScore: 10,
        reason: 'The link does not use the official coursera.org domain',
      };
    }

    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'CertiFlow-Verification/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        ...invalidResult,
        reason: `Coursera returned HTTP ${response.status}`,
      };
    }

    const finalUrl = new URL(response.url);
    const html = await response.text();

    const officialFinalDomain =
      finalUrl.hostname === 'coursera.org' ||
      finalUrl.hostname === 'www.coursera.org';

    const isVerificationPage =
      finalUrl.pathname.includes('/account/accomplishments/verify/') ||
      finalUrl.pathname.includes('/account/accomplishments/certificate/');

    const decodedHtml = html
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"');

    const namePatterns = [
  /Completed by\s*([^<"\n]{2,100})/i,
  /Awarded to\s*([^<"\n]{2,100})/i,
  /Issued to\s*([^<"\n]{2,100})/i,
  /"recipientName"\s*:\s*"([^"]{2,100})"/i,
  /"learnerName"\s*:\s*"([^"]{2,100})"/i,
  /"name"\s*:\s*"([^"]{2,100})"/i,
];

let detectedStudentName = 'Name not detected';

for (const pattern of namePatterns) {
  const match = decodedHtml.match(pattern);

  if (!match?.[1]) {
    continue;
  }

  const possibleName = match[1]
    .replace(/\\u0026/g, '&')
    .replace(/\\u0027/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const invalidNames = [
    'coursera',
    'course certificate',
    'certificate',
    'name',
    'online courses',
  ];

  const isValidName =
    possibleName.length >= 3 &&
    possibleName.length <= 100 &&
    !invalidNames.includes(possibleName.toLowerCase()) &&
    !possibleName.toLowerCase().includes('certificate') &&
    !possibleName.startsWith('http');

  if (isValidName) {
    detectedStudentName = possibleName;
    break;
  }
}

    const certificateIdMatch = finalUrl.pathname.match(
      /\/(?:verify|certificate)\/([A-Za-z0-9_-]+)/i
    );

    const hasCertificateEvidence =
      /Course Certificate/i.test(decodedHtml) ||
      /account is verified/i.test(decodedHtml) ||
      /successful completion/i.test(decodedHtml);

    if (
      officialFinalDomain &&
      isVerificationPage &&
      hasCertificateEvidence
    ) {
      return {
        status: 'verified',
        trustScore: 100,
        issuer: 'Coursera',
        documentType: 'Course Certificate',
        studentName: detectedStudentName,
        courseName: 'Course detected on official Coursera page',
        certificateId:
          certificateIdMatch?.[1] || 'ID not detected',
        verifiedUrl: finalUrl.toString(),
        reason:
          'Certificate was found on an official Coursera verification page',
      };
    }

    return {
      ...invalidResult,
      status: 'suspicious',
      trustScore: 35,
      verifiedUrl: finalUrl.toString(),
      reason:
        'The URL uses Coursera, but an official certificate verification page was not confirmed',
    };
  } catch (error) {
    console.error('Coursera verification failed:', error);
    return invalidResult;
  }
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 50,
  },
  fileFilter: (_req, file, callback) => {
    const supportedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
    ];

    if (!supportedTypes.includes(file.mimetype)) {
      callback(new Error(`Unsupported file type: ${file.originalname}`));
      return;
    }

    callback(null, true);
  },
});

router.post(
  '/',
  upload.array('certificates', 50),
  async (req, res) => {
    try {
      const files = (req.files as Express.Multer.File[]) ?? [];

      let links: string[] = [];

      if (typeof req.body.links === 'string') {
        try {
          const parsedLinks = JSON.parse(req.body.links);

          if (Array.isArray(parsedLinks)) {
            links = parsedLinks.filter(
              (link): link is string => typeof link === 'string',
            );
          }
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Certificate links are invalid',
          });
        }
      }

      if (files.length === 0 && links.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Upload at least one certificate or provide a link',
        });
      }

      const fileResults = await Promise.all(
        files.map(async (file) => {
          let extractedText = '';
          let studentName = 'Name not detected';

          if (file.mimetype === 'application/pdf') {
            const parser = new PDFParse({
              data: new Uint8Array(file.buffer),
            });

            try {
              const parsedPdf = await parser.getText();
              extractedText = parsedPdf.text ?? '';

              console.log('========== PDF TEXT ==========');
              console.log(extractedText);
              console.log('==============================');

              const labelledNamePatterns = [
                /(?:student\s*name|recipient\s*name|candidate\s*name|employee\s*name)\s*[:\-]\s*(?!_)([A-Za-z][A-Za-z .'-]{2,60})/i,
                /(?:awarded\s+to|presented\s+to|certifies\s+that|this\s+is\s+to\s+certify\s+that)\s+(?!_)([A-Za-z][A-Za-z .'-]{2,60})/i,
              ];

              for (const pattern of labelledNamePatterns) {
                const match = extractedText.match(pattern);

                if (match?.[1]) {
                  const detectedName = match[1].trim();

                  const invalidValues = [
                    'date',
                    'job title',
                    'first name',
                    'last name',
                    'middle initial',
                    'name',
                  ];

                  const isInvalidName =
                    invalidValues.includes(detectedName.toLowerCase()) ||
                    detectedName.includes('_') ||
                    detectedName.length < 3;

                  if (!isInvalidName) {
                    studentName = detectedName;
                    break;
                  }
                }
              }
            } catch (error) {
              console.error(
                `PDF extraction failed for ${file.originalname}:`,
                error,
              );
            } finally {
              await parser.destroy();
            }
          }

         const publicIdMatch = extractedText.match(
  /\bCF-[0-9A-Z]{4,8}-[0-9A-Z]{2,6}\b/i,
);

const publicId = publicIdMatch?.[0]?.toUpperCase() ?? null;

const hasExtractedText = extractedText.trim().length > 0;
const hasStudentName = studentName !== 'Name not detected';
const normalizedText = extractedText.toLowerCase();

const certificateKeywords = [
  'certificate',
  'certifies that',
  'awarded to',
  'presented to',
  'course completion',
  'credential id',
  'certificate id',
];

const offerLetterKeywords = [
  'offer letter',
  'letter of offer',
  'employment offer',
  'offer of employment',
  'position of',
  'date of joining',
  'joining date',
  'annual compensation',
  'salary',
  'human resources',
  'terms and conditions',
];

const appearsToBeCertificate = certificateKeywords.some((keyword) =>
  normalizedText.includes(keyword),
);

const appearsToBeOfferLetter = offerLetterKeywords.some((keyword) =>
  normalizedText.includes(keyword),
);

const documentType = appearsToBeCertificate
  ? 'Certificate'
  : appearsToBeOfferLetter
    ? 'Offer Letter'
    : 'Unknown Document';
    let trustScore = 0;
const trustReasons: string[] = [];

if (hasExtractedText) {
  trustScore += 10;
  trustReasons.push('Document text was successfully extracted');
}

if (appearsToBeCertificate) {
  trustScore += 20;
  trustReasons.push('Certificate-related content was detected');
}

if (appearsToBeOfferLetter) {
  trustScore += 20;
  trustReasons.push('Offer-letter-related content was detected');
}

const hasOfficialEmail = /\b[A-Z0-9._%+-]+@(?!gmail\.com|yahoo\.com|outlook\.com|hotmail\.com)[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(
  extractedText,
);

if (hasOfficialEmail) {
  trustScore += 20;
  trustReasons.push('Official organization email domain was detected');
}

const hasSignatureEvidence =
  normalizedText.includes('authorized signatory') ||
  normalizedText.includes('human resources') ||
  normalizedText.includes('hr manager') ||
  normalizedText.includes('signature');

if (hasSignatureEvidence) {
  trustScore += 15;
  trustReasons.push('Signature or HR authorization evidence was detected');
}

const hasDateEvidence =
  /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(extractedText) ||
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(
    extractedText,
  );

if (hasDateEvidence) {
  trustScore += 10;
  trustReasons.push('Document date was detected');
}

if (publicId) {
  trustScore += 25;
  trustReasons.push('CertiFlow certificate ID was detected');
}

trustScore = Math.min(trustScore, 100);


if (!hasExtractedText) {
  return {
    student: studentName,
    certificateId: 'Not detected',
    status: 'Pending',
    reason: 'Could not extract document text',
    source: file.originalname,
    documentType,
    trustScore,
  };
}

if (!appearsToBeCertificate && !appearsToBeOfferLetter) {
  return {
    student: studentName,
    certificateId: 'Not detected',
    status: 'Fake',
    reason: `Uploaded document does not appear to be a certificate or offer letter. ${trustReasons.join(', ')}`,
    source: file.originalname,
    documentType,
    trustScore,
  };
}

if (!publicId) {
  if (appearsToBeOfferLetter) {
    let offerLetterStatus: 'Verified' | 'Pending' | 'Fake';

    if (trustScore >= 70) {
      offerLetterStatus = 'Verified';
    } else if (trustScore >= 40) {
      offerLetterStatus = 'Pending';
    } else {
      offerLetterStatus = 'Fake';
    }

    return {
      student: studentName,
      certificateId: 'Not applicable',
      status: offerLetterStatus,
      reason: `Offer letter evaluated using document trust evidence. ${trustReasons.join(', ')}`,
      source: file.originalname,
      documentType,
      trustScore,
    };
  }

  return {
    student: studentName,
    certificateId: 'Not detected',
    status: 'Pending',
    reason: hasStudentName
      ? `Student name detected, but CertiFlow certificate ID was not found. ${trustReasons.join(', ')}`
      : `Student name and CertiFlow certificate ID were not detected. ${trustReasons.join(', ')}`,
    source: file.originalname,
    documentType,
    trustScore,
  };
}

const verification = await getVerification(publicId);

if (!verification.found) {
  return {
    student: studentName,
    certificateId: publicId,
    status: 'Fake',
    reason: `Certificate ID was not found in the CertiFlow database. ${trustReasons.join(', ')}`,
    source: file.originalname,
    documentType,
    trustScore,
  };
}
let finalStatus: 'Verified' | 'Pending' | 'Fake';

if (trustScore >= 80) {
  finalStatus = 'Verified';
} else if (trustScore >= 50) {
  finalStatus = 'Pending';
} else {
  finalStatus = 'Fake';
}

return {
  student: studentName,
  certificateId: publicId,
  status: 'finalStatus',
  reason: `Certificate ID matched a valid CertiFlow record. ${trustReasons.join(', ')}`,
  source: file.originalname,
  documentType,
  trustScore,
};
        }),
      );

     const linkResults = await Promise.all(
  links.map(async (link, index) => {
    let hostname = '';

try {
  hostname = new URL(link).hostname.toLowerCase();
} catch {
  return {
    student: `Certificate Link ${index + 1}`,
    certificateId: 'Not detected',
    status: 'Fake',
    reason: 'Invalid URL format',
    source: link,
    issuer: 'Unknown',
    trustScore: 0,
  };
}

const provider = detectVerificationProvider(link);

switch (provider) {
  case 'coursera': {
    const verification = await verifyCourseraLink(link);

    const status =
      verification.status === 'verified'
        ? 'Verified'
        : verification.status === 'suspicious'
          ? 'Pending'
          : 'Fake';

    return {
  student: verification.studentName,
  certificateId: verification.certificateId,
  status,
  reason: verification.reason,
  source: verification.verifiedUrl,
  issuer: verification.issuer,
  documentType: verification.documentType,
  trustScore: verification.trustScore,
};
  }

  default:
    return {
      student: `Certificate Link ${index + 1}`,
      certificateId: 'Not detected',
      status: 'Pending',
      reason: `Verification for "${provider}" is not implemented yet`,
      source: link,
      issuer: provider,
      trustScore: 20,
    };
}
}

  ),
);

      return res.status(200).json({
        success: true,
        results: [...fileResults, ...linkResults],
      });
    } catch (error) {
      console.error('Bulk verification error:', error);

      return res.status(500).json({
        success: false,
        message: 'Bulk certificate verification failed',
      });
    }
  },
);

export default router;
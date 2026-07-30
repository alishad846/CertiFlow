import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { getVerification } from '../services/certificates';

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
const certificateKeywords = [
  'certificate',
  'certifies that',
  'awarded to',
  'presented to',
  'course completion',
  'credential id',
  'certificate id',
];

const appearsToBeCertificate = certificateKeywords.some((keyword) =>
  extractedText.toLowerCase().includes(keyword),
);

if (!hasExtractedText) {
  return {
    student: studentName,
    certificateId: 'Not detected',
    status: 'Pending',
    reason: 'Could not extract certificate text',
    source: file.originalname,
  };
}

if (!appearsToBeCertificate) {
  return {
    student: studentName,
    certificateId: 'Not detected',
    status: 'Fake',
    reason: 'Uploaded document does not appear to be a certificate',
    source: file.originalname,
  };
}

if (!publicId) {
  return {
    student: studentName,
    certificateId: 'Not detected',
    status: 'Pending',
    reason: hasStudentName
      ? 'Student name detected, but CertiFlow certificate ID was not found'
      : 'Student name and CertiFlow certificate ID were not detected',
    source: file.originalname,
  };
}

const verification = await getVerification(publicId);

if (!verification.found) {
  return {
    student: studentName,
    certificateId: publicId,
    status: 'Fake',
    reason: 'Certificate ID was not found in the CertiFlow database',
    source: file.originalname,
  };
}

return {
  student: studentName,
  certificateId: publicId,
  status: 'Verified',
  reason: 'Certificate ID matched a valid CertiFlow record',
  source: file.originalname,
};
        }),
      );

      const linkResults = links.map((link, index) => ({
        student: `Certificate Link ${index + 1}`,
        certificateId: `LINK-${1001 + index}`,
        status: 'Pending',
        reason: 'Link verification is not implemented yet',
        source: link,
      }));

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
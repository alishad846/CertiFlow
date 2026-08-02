import { describe, expect, it } from 'vitest';
import {
  applyCandidateNameMatching,
  classifyDocumentText,
} from '../bulk-verification';

describe('bulk verification helpers', () => {
  it('classifies resume content as a resume document', () => {
    const analysis = classifyDocumentText(`
      John Doe
      Summary
      Experience
      Education
      Skills
      Phone: +1 555 123 4567
      Email: john.doe@example.com
    `);

    expect(analysis.documentType).toBe('Resume');
    expect(analysis.trustScore).toBeGreaterThan(0);
  });

  it('marks a certificate as fake when the candidate name does not match any uploaded resume', () => {
    const results = applyCandidateNameMatching(
      [
        {
          student: 'Jane Doe',
          certificateId: 'CF-1234-AB12',
          status: 'Verified',
          reason: 'Certificate ID matched a valid CertiFlow record.',
          source: 'certificate.pdf',
          documentType: 'Certificate',
          trustScore: 85,
        },
      ],
      ['john doe'],
    );

    expect(results[0].status).toBe('Fake');
    expect(results[0].reason).toContain('does not match any uploaded resume');
  });
});

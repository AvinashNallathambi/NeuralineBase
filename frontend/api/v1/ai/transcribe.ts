import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // Whisper transcription requires GPU/CPU inference and cannot run
  // on Vercel serverless functions.  Return a helpful error.
  return res.status(503).json({
    message: 'Audio transcription is not available in the Vercel deployment. '
      + 'Please run the application locally with Docker to use the Whisper transcription service. '
      + 'You can manually enter a transcript and use the SOAP generation and coding suggestion features.',
    text: '',
    segments: [],
    language: '',
    duration: 0,
    processing_time: 0,
  });
}

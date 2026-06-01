import type { Request, Response } from 'express';
import { createVercelHandler } from '../src/vercel';

export default async function handler(req: Request, res: Response) {
  const server = await createVercelHandler();
  return server(req, res);
}

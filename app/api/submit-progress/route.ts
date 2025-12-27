import { NextRequest } from 'next/server';
import { getProgress } from '@/lib/progress-tracker';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return new Response('Task ID required', { status: 400 });
  }

  const progress = getProgress(taskId);

  return new Response(JSON.stringify(progress), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}


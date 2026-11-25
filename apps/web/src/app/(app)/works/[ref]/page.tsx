import { decodeRouteParam } from '@/features/catalog/hrefs';
import { WorkPage } from '@/features/works/WorkPage';

export default async function WorkRoute({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <WorkPage workRef={decodeRouteParam(ref)} />;
}

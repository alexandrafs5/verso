import { decodeRouteParam } from '@/features/catalog/hrefs';
import { SeriesPage } from '@/features/series/SeriesPage';

export default async function SeriesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SeriesPage seriesId={decodeRouteParam(id)} />;
}

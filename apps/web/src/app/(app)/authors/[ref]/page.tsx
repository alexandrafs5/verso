import { AuthorPage } from '@/features/authors/AuthorPage';
import { decodeRouteParam } from '@/features/catalog/hrefs';

export default async function AuthorRoute({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <AuthorPage authorRef={decodeRouteParam(ref)} />;
}
